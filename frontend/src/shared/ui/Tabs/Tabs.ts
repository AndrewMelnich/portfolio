const TOGGLER_DATA_ATTR = 'data-tabs-toggler';
const CONTENT_DATA_ATTR = 'data-tabs-content';
const TOGGLER_ACTIVE_CLASS = 'is-active';

function getTablist(root: HTMLElement): HTMLElement | null {
    return root.querySelector<HTMLElement>('[role="tablist"]');
}

function getOrientation(tablist: HTMLElement): 'horizontal' | 'vertical' {
    const value = tablist.getAttribute('aria-orientation');

    return value === 'vertical' ? 'vertical' : 'horizontal';
}

function updateRovingTabindex(togglers: HTMLElement[], activeIndex: number) {
    togglers.forEach((el, index) => {
        el.setAttribute('tabindex', index === activeIndex ? '0' : '-1');
    });
}

function setTabById(id: string, tabsId: string, options: { focusTab?: boolean } = {}) {
    const root = document.querySelector<HTMLElement>(`#${CSS.escape(tabsId)}`);
    const tablist = root ? getTablist(root) : null;

    if (!root || !tablist) {
        return;
    }

    const allTogglers = Array.from(tablist.querySelectorAll<HTMLElement>(`[${TOGGLER_DATA_ATTR}]`));
    const allContents = Array.from(root.querySelectorAll<HTMLElement>(`[${CONTENT_DATA_ATTR}]`));
    const tabsToggler = allTogglers.find((el) => el.getAttribute(TOGGLER_DATA_ATTR) === id);
    const tabsContent = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    const activeIndex = allTogglers.findIndex((el) => el.getAttribute(TOGGLER_DATA_ATTR) === id);

    allContents.forEach((el) => {
        el.hidden = true;
        el.setAttribute('tabindex', '-1');
    });

    allTogglers.forEach((el) => {
        el.classList.remove(TOGGLER_ACTIVE_CLASS);
        el.setAttribute('aria-selected', 'false');
    });

    if (tabsContent) {
        tabsContent.hidden = false;
        tabsContent.setAttribute('tabindex', '-1');
    }

    if (tabsToggler) {
        tabsToggler.classList.add(TOGGLER_ACTIVE_CLASS);
        tabsToggler.setAttribute('aria-selected', 'true');

        if (options.focusTab !== false) {
            tabsToggler.focus();
        }
    }

    if (activeIndex >= 0) {
        updateRovingTabindex(allTogglers, activeIndex);
    }
}

function onTogglerClick(this: HTMLElement) {
    const id = this.getAttribute(TOGGLER_DATA_ATTR);
    const tabsId = this.closest<HTMLElement>('.js-tabs')?.id || '';

    if (id && tabsId) {
        setTabById(id, tabsId);
    }
}

function onTogglerKeydown(this: HTMLElement, event: KeyboardEvent) {
    const tabsId = this.closest<HTMLElement>('.js-tabs')?.id || '';
    const root = tabsId ? document.querySelector<HTMLElement>(`#${CSS.escape(tabsId)}`) : null;
    const tablist = root ? getTablist(root) : null;

    if (!root || !tablist) {
        return;
    }

    const orientation = getOrientation(tablist);
    const allTogglers = Array.from(tablist.querySelectorAll<HTMLElement>(`[${TOGGLER_DATA_ATTR}]`));
    const currentIndex = allTogglers.indexOf(this);
    let targetIndex = currentIndex;

    switch (event.key) {
        case 'ArrowLeft':
            if (orientation !== 'horizontal') {
                return;
            }

            event.preventDefault();
            targetIndex = currentIndex > 0 ? currentIndex - 1 : allTogglers.length - 1;
            break;

        case 'ArrowRight':
            if (orientation !== 'horizontal') {
                return;
            }

            event.preventDefault();
            targetIndex = currentIndex < allTogglers.length - 1 ? currentIndex + 1 : 0;
            break;

        case 'ArrowUp':
            if (orientation !== 'vertical') {
                return;
            }

            event.preventDefault();
            targetIndex = currentIndex > 0 ? currentIndex - 1 : allTogglers.length - 1;
            break;

        case 'ArrowDown':
            if (orientation !== 'vertical') {
                return;
            }

            event.preventDefault();
            targetIndex = currentIndex < allTogglers.length - 1 ? currentIndex + 1 : 0;
            break;

        case 'Home':
            event.preventDefault();
            targetIndex = 0;
            break;

        case 'End':
            event.preventDefault();
            targetIndex = allTogglers.length - 1;
            break;

        default:
            return;
    }

    const targetId = allTogglers[targetIndex]?.getAttribute(TOGGLER_DATA_ATTR);

    if (targetId) {
        setTabById(targetId, tabsId);
    }
}

function getInitialActiveIndex(togglers: HTMLElement[]): number {
    const selectedIndex = togglers.findIndex((el) => el.getAttribute('aria-selected') === 'true');

    if (selectedIndex >= 0) {
        return selectedIndex;
    }

    const activeClassIndex = togglers.findIndex((el) => el.classList.contains(TOGGLER_ACTIVE_CLASS));

    if (activeClassIndex >= 0) {
        return activeClassIndex;
    }

    return 0;
}

export function init(container: Element | Document = document) {
    Array.from(container.querySelectorAll<HTMLElement>('.js-tabs')).forEach((root) => {
        const tabsId = root.id;
        const tablist = getTablist(root);

        if (!tabsId || !tablist) {
            return;
        }

        const tabTogglers = Array.from(tablist.querySelectorAll<HTMLElement>(`[${TOGGLER_DATA_ATTR}]`));
        const activeIndex = getInitialActiveIndex(tabTogglers);

        tabTogglers.forEach((el) => {
            el.addEventListener('click', onTogglerClick);
            el.addEventListener('keydown', onTogglerKeydown);
        });

        const activePanelId = tabTogglers[activeIndex]?.getAttribute(TOGGLER_DATA_ATTR);

        if (activePanelId) {
            setTabById(activePanelId, tabsId, { focusTab: false });
        }
    });
}

export default { init };
