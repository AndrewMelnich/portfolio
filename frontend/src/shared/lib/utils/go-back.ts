/**
 * Функция возврата назад
 *
 * Проверяет наличие истории браузера и выполняет возврат назад или переход на fallback URL.
 *
 * @param fallbackUrl - URL для перехода, если нет истории (по умолчанию '/')
 *
 * @example
 * ```typescript
 * import { goBack } from '@/utils/go-back';
 *
 * const handleClose = () => {
 *   goBack('/menu'); // Вернется назад или перейдет на /menu
 * };
 * ```
 */
export const goBack = (fallbackUrl = '/') => {
    if (window.history.length > 2) {
        window.history.back();
    } else {
        window.location.href = fallbackUrl;
    }
};
