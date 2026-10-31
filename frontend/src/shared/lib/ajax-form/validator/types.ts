type ValidatorHook = () => void;

export type ValidatorOptions = {
    inputGroupSelector: string;
    inputSelector: string;
    messages: {
        [lang: string]: Record<string, string>;
    };
    onValidationComplete?: ValidatorHook;
    onValidationError?: ValidatorHook;
    onValidationSuccess?: ValidatorHook;
    scrollToInvalidInput: boolean;
    scrollToInvalidInputOptions?: ScrollIntoViewOptions;
};
