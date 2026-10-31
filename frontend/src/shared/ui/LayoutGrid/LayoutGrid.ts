export function init() {
    const key = 'k';
    let visible = false;

    function getGrid() {
        return document.getElementById('layout-grid');
    }

    function showOnTopLayer(grid: HTMLElement) {
        if (grid.matches(':popover-open')) {
            grid.hidePopover();
        }

        grid.showPopover();
    }

    function setVisible(next: boolean) {
        const grid = getGrid();

        if (!grid) return;

        visible = next;

        if (visible) {
            showOnTopLayer(grid);
        } else if (grid.matches(':popover-open')) {
            grid.hidePopover();
        }
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === key || event.key === key.toUpperCase()) {
            setVisible(!visible);
        }
    }

    document.addEventListener(
        'popup-open',
        () => {
            if (visible) {
                const grid = getGrid();

                if (grid) showOnTopLayer(grid);
            }
        },
        true,
    );

    document.addEventListener('keydown', onKeydown);
}

export default { init };
