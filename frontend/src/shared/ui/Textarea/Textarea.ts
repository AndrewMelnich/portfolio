import { initFloatedLabel } from '@/shared/ui/Input/floatedLabels';

export function init(container: Element | Document = document) {
    container.querySelectorAll('.js-input-group--textarea').forEach(initFloatedLabel);
}

export default { init };
