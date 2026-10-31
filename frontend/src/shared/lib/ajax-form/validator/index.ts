import equals from 'validator/lib/equals';
import isDate from 'validator/lib/isDate';
import isEmail from 'validator/lib/isEmail';
import messages from './messages';
import type { ValidatorOptions } from './types';
import { clearMessages, getLang } from './utils';

const ERROR_CLASS = 'is-error';

export { isEmail, equals };

function transformDateString(dateString: string) {
    // Split the date string by '.'
    const parts = dateString.split('.');

    // Reformat the date string
    return parts[1] + '/' + parts[0] + '/' + parts[2];
}

export function isPhone(string: string): boolean {
    return /^\+?\d{7,14}$/.test(string.replace(/[\s()+\-.]|ext/gi, ''));
}

function isPhoneInput(input: HTMLInputElement) {
    return input.type === 'tel' || input.classList.contains('js-validate--phone');
}

function isEmailInput(input: HTMLInputElement) {
    return input.type === 'email' || input.classList.contains('js-validate--email');
}

function isCheckboxInput(input: HTMLInputElement) {
    return input.type === 'checkbox';
}

function isSelectInput(input: HTMLInputElement) {
    return input.tagName === 'select' || input.classList.contains('js-validate--select');
}

function isAddressInput(input: HTMLInputElement) {
    return input.classList.contains('js-validate--address');
}

function isEmptyInput(input: HTMLInputElement) {
    return input.value.trim().length === 0;
}

function isDateInput(input: HTMLInputElement) {
    return input.classList.contains('js-validate--date');
}

interface ItiInstance {
    isValidNumber(): boolean | null;
    getValidationError(): number;
}

interface IntlTelInputGlobals {
    getInstance(input: HTMLInputElement): ItiInstance | null;
}

function hasKey<K extends string>(value: object, key: K): value is Record<K, unknown> {
    return key in value;
}

function readProperty<K extends string>(value: object, key: K): unknown {
    if (!hasKey(value, key)) {
        return undefined;
    }

    return value[key];
}

function isItiInstance(value: unknown): value is ItiInstance {
    return (
        typeof value === 'object' &&
        value !== null &&
        'isValidNumber' in value &&
        'getValidationError' in value &&
        typeof value.isValidNumber === 'function' &&
        typeof value.getValidationError === 'function'
    );
}

function isIntlTelInputGlobals(value: unknown): value is IntlTelInputGlobals {
    return (
        typeof value === 'object' && value !== null && 'getInstance' in value && typeof value.getInstance === 'function'
    );
}

function getItiInstance(input: HTMLInputElement): ItiInstance | null | undefined {
    const attached = readProperty(input, '_iti');

    if (isItiInstance(attached)) {
        return attached;
    }

    if (attached) {
        return null;
    }

    const globals = readProperty(window, 'intlTelInputGlobals');

    if (!isIntlTelInputGlobals(globals)) {
        return undefined;
    }

    return globals.getInstance(input);
}

type Check = boolean | null;

function firstDecision(checks: Check[]): boolean | null {
    for (const result of checks) {
        if (result !== null) {
            return result;
        }
    }

    return null;
}

function validateCustom(input: HTMLInputElement): Check {
    if (!input.classList.contains('js-validate--custom')) {
        return null;
    }

    const regExp = input.getAttribute('data-custom-validation') || '.*';

    return new RegExp(regExp, 'i').test(input.value);
}

function validateEmail(input: HTMLInputElement): Check {
    if (!isEmailInput(input)) {
        return null;
    }

    if (!input.hasAttribute('required') && isEmptyInput(input)) {
        return true;
    }

    return isEmail(input.value);
}

function applyItiResult(input: HTMLInputElement, iti: ItiInstance) {
    const isValid = iti.isValidNumber();

    if (isValid) {
        delete input.dataset.itiErrorCode;

        return true;
    }

    input.dataset.itiErrorCode = iti.getValidationError().toString();

    return false;
}

function phoneWhenPresent(input: HTMLInputElement) {
    const iti = getItiInstance(input);

    if (iti) {
        return applyItiResult(input, iti);
    }

    return isPhone(input.value);
}

function validatePhone(input: HTMLInputElement): Check {
    if (!isPhoneInput(input)) {
        return null;
    }

    if (!input.hasAttribute('required') && isEmptyInput(input)) {
        return true;
    }

    return phoneWhenPresent(input);
}

function validateCheckbox(input: HTMLInputElement): Check {
    if (!isCheckboxInput(input)) {
        return null;
    }

    return input.hasAttribute('required') ? input.checked : true;
}

function optionIsChosen(option: HTMLOptionElement, input: HTMLInputElement) {
    return (
        option.selected && !option.hasAttribute('placeholder') && option.innerText !== input.getAttribute('placeholder')
    );
}

function validateSelect(input: HTMLInputElement): Check {
    if (!isSelectInput(input)) {
        return null;
    }

    if (!input.hasAttribute('required')) {
        return true;
    }

    return Array.from(input.querySelectorAll('option')).some((option) => optionIsChosen(option, input));
}

function dateBounds(input: HTMLInputElement) {
    const minRaw = input.dataset.validateCustomDateMinYearsOld;
    const maxRaw = input.dataset.validateCustomDateMaxYearsOld;

    return {
        min: minRaw ? parseInt(minRaw) : 0,
        max: maxRaw ? parseInt(maxRaw) : Infinity,
    };
}

function dateInRange(age: number, bounds: { min: number; max: number }) {
    return age >= bounds.min && age <= bounds.max;
}

function dateFormatOk(trimmed: string) {
    return isDate(trimmed, { delimiters: ['/', '-', '.'], format: 'DD.MM.YYYY' });
}

function futureAllowed(input: HTMLInputElement, date: Date, current: Date) {
    if (!input.hasAttribute('data-validate-custom-date-disallow-future')) {
        return true;
    }

    return date.getTime() <= current.getTime();
}

function dateIsValid(input: HTMLInputElement) {
    const trimmed = input.value.trim();
    const date = new Date(Date.parse(transformDateString(trimmed)));
    const current = new Date();
    const age = current.getFullYear() - date.getFullYear();
    const filled = input.hasAttribute('required') ? input.value.length > 0 : true;

    return (
        filled && dateInRange(age, dateBounds(input)) && dateFormatOk(trimmed) && futureAllowed(input, date, current)
    );
}

function validateDate(input: HTMLInputElement): Check {
    if (!isDateInput(input)) {
        return null;
    }

    return dateIsValid(input);
}

function addressPartsUnique(value: string) {
    const parts = value.split(',').map((part) => part.trim());

    return parts.length === new Set(parts).size;
}

function validateAddress(input: HTMLInputElement): Check {
    if (!isAddressInput(input)) {
        return null;
    }

    return new RegExp(/.+,?\s+.+,?\s+.+/, 'i').test(input.value) && addressPartsUnique(input.value);
}

function validateEquivalent(input: HTMLInputElement, container: HTMLElement | Document): Check {
    if (!input.classList.contains('js-validate--equivalent')) {
        return null;
    }

    if (!input.hasAttribute('data-equivalent-name')) {
        return false;
    }

    const fieldName = input.getAttribute('data-equivalent-name');
    const field = container.querySelector<HTMLInputElement>(`[name="${fieldName}"]`);

    return field ? equals(input.value, field.value) : false;
}

export function validateInput(input: HTMLInputElement, container: HTMLElement | Document = document): boolean {
    const result = firstDecision([
        validateCustom(input),
        validateEmail(input),
        validatePhone(input),
        validateCheckbox(input),
        validateSelect(input),
        validateDate(input),
        validateAddress(input),
        validateEquivalent(input, container),
    ]);

    if (result !== null) {
        return result;
    }

    return input.hasAttribute('required') ? !isEmptyInput(input) : true;
}

const DEFAULT_OPTIONS: ValidatorOptions = {
    inputGroupSelector: '.js-input-group',
    inputSelector:
        'input[name]:not([type="submit"]):not([type="reset"]):not([type="hidden"]), select[name]:not([type="submit"]):not([type="reset"]):not([type="hidden"]), textarea[name]:not([type="submit"]):not([type="reset"]):not([type="hidden"])',
    messages,
    scrollToInvalidInput: true,
};

type MessageDict = Record<string, string>;

function phoneCodeMessage(errorCode: number, dict: MessageDict) {
    if (errorCode === 1) {
        return dict.INVALIDATED_PHONE_INVALID_COUNTRY;
    }

    if (errorCode === 2) {
        return dict.INVALIDATED_PHONE_TOO_SHORT;
    }

    if (errorCode === 3) {
        return dict.INVALIDATED_PHONE_TOO_LONG;
    }

    return dict.INVALIDATED_PHONE;
}

function phoneMessage(input: HTMLInputElement, dict: MessageDict) {
    const raw = input.dataset.itiErrorCode;

    if (!raw) {
        return dict.INVALIDATED_PHONE;
    }

    return phoneCodeMessage(parseInt(raw), dict);
}

function leadingMessage(input: HTMLInputElement, dict: MessageDict) {
    if (isCheckboxInput(input)) {
        return dict.INVALIDATED_CHECKBOX;
    }

    if (isEmptyInput(input) && input.hasAttribute('required')) {
        return dict.EMPTY_FIELD;
    }

    return undefined;
}

function contactMessage(input: HTMLInputElement, dict: MessageDict) {
    if (isEmailInput(input)) {
        return dict.INVALIDATED_EMAIL;
    }

    if (isPhoneInput(input)) {
        return phoneMessage(input, dict);
    }

    return undefined;
}

function kindMessage(input: HTMLInputElement, dict: MessageDict) {
    if (isSelectInput(input)) {
        return dict.INVALIDATED_SELECT;
    }

    if (input.classList.contains('js-validate--equivalent')) {
        return dict.INVALIDATED_EQUALS;
    }

    return undefined;
}

function classKindMessage(input: HTMLInputElement, dict: MessageDict) {
    if (input.classList.contains('js-validate--address')) {
        return dict.INVALIDATED_ADDRESS;
    }

    if (input.classList.contains('js-validate--date')) {
        return dict.INVALIDATED_DATE;
    }

    return undefined;
}

function customErrorMessage(input: HTMLInputElement) {
    if (!input.classList.contains('js-validate--custom')) {
        return undefined;
    }

    if (!input.hasAttribute('data-custom-validation-error-message')) {
        return undefined;
    }

    return input.getAttribute('data-custom-validation-error-message');
}

function laterMessage(input: HTMLInputElement, dict: MessageDict) {
    return kindMessage(input, dict) ?? classKindMessage(input, dict) ?? customErrorMessage(input) ?? null;
}

function errorMessageFor(input: HTMLInputElement, options: ValidatorOptions, lang: string) {
    const dict = options.messages[lang];

    if (!dict) {
        return null;
    }

    return leadingMessage(input, dict) ?? contactMessage(input, dict) ?? laterMessage(input, dict);
}

function clearGroup(inputGroup: HTMLElement, options: ValidatorOptions) {
    const input = inputGroup.querySelector<HTMLInputElement>(options.inputSelector);
    const messageElement = inputGroup?.querySelector('.js-app-message');

    if (messageElement) {
        messageElement.textContent = '';
    }

    inputGroup?.classList.remove(ERROR_CLASS);

    if (input?.tagName === 'TEXTAREA') {
        input.closest('.js-input-group--textarea')?.classList.remove(ERROR_CLASS);
    }
}

function writeMessage(messageElement: Element | null, applyToUi: boolean, errorMessage: string | null) {
    if (!messageElement) {
        return;
    }

    messageElement.textContent = '';

    if (applyToUi) {
        messageElement.textContent = errorMessage || '';
    }
}

function paintInvalid(
    inputGroup: HTMLElement,
    input: HTMLInputElement,
    applyToUi: boolean,
    options: ValidatorOptions,
    lang: string,
) {
    if (applyToUi) {
        inputGroup?.classList.add(ERROR_CLASS);
    }

    const errorMessage = errorMessageFor(input, options, lang);

    input.dispatchEvent(new CustomEvent('ajax-form:error', { detail: { error: errorMessage } }));
    writeMessage(inputGroup?.querySelector('.js-app-message') ?? null, applyToUi, errorMessage);
}

function paintGroup(
    inputGroup: HTMLElement,
    input: HTMLInputElement,
    isValid: boolean,
    applyToUi: boolean,
    options: ValidatorOptions,
    lang: string,
) {
    if (isValid) {
        inputGroup?.classList.remove(ERROR_CLASS);

        return;
    }

    paintInvalid(inputGroup, input, applyToUi, options, lang);
}

function visitGroups(
    form: HTMLFormElement,
    options: ValidatorOptions,
    inputGroups: HTMLElement[],
    applyToUi: boolean,
    erroredInputs: HTMLInputElement[],
) {
    let isFormValid = true;
    const lang = getLang();

    for (const inputGroup of inputGroups) {
        const input = inputGroup.querySelector<HTMLInputElement>(options.inputSelector);

        if (!input) {
            continue;
        }

        const isValid = validateInput(input, form);

        if (!isValid) {
            isFormValid = false;
            erroredInputs.push(input);
        }

        paintGroup(inputGroup, input, isValid, applyToUi, options, lang);
    }

    return isFormValid;
}

function scrollToFirstInvalid(options: ValidatorOptions, applyToUi: boolean, erroredInputs: HTMLInputElement[]) {
    if (applyToUi && options.scrollToInvalidInput && erroredInputs[0]) {
        erroredInputs[0].scrollIntoView(options.scrollToInvalidInputOptions);
    }
}

function finishValidation(options: ValidatorOptions, isFormValid: boolean) {
    if (isFormValid) {
        options.onValidationSuccess?.();
    } else {
        options.onValidationError?.();
    }

    options.onValidationComplete?.();
}

function validateForm(form: HTMLFormElement, options: ValidatorOptions, inputGroups: HTMLElement[], applyToUi = true) {
    const erroredInputs: HTMLInputElement[] = [];

    clearMessages(form);

    const isFormValid = visitGroups(form, options, inputGroups, applyToUi, erroredInputs);

    scrollToFirstInvalid(options, applyToUi, erroredInputs);
    finishValidation(options, isFormValid);

    return isFormValid;
}

export default (form: HTMLFormElement, validatorOptions: Partial<ValidatorOptions> = DEFAULT_OPTIONS) => {
    const options: ValidatorOptions = { ...DEFAULT_OPTIONS, ...validatorOptions };

    form.setAttribute('novalidate', 'novalidate');

    const inputGroups = Array.from(form.querySelectorAll<HTMLElement>(options.inputGroupSelector));

    return {
        validate: (applyToUi = true) => validateForm(form, options, inputGroups, applyToUi),
        form,
        inputGroups,
        clearInput: (inputGroup: HTMLElement) => clearGroup(inputGroup, options),
    };
};
