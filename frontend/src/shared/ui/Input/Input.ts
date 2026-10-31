import { initFloatedLabel } from './floatedLabels';

export function init(container: Element | Document = document) {
    container.querySelectorAll('.js-input-group').forEach(initFloatedLabel);
}

export default { init };
