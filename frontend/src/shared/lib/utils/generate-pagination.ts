export function generatePagination(totalPages: number, activePage: number) {
    const maxPagesToShow = 1; // Максимальное количество страниц, отображаемых до и после текущей страницы
    const pages = [...Array(totalPages).keys()].map((num) => num + 1);

    // Определение номеров страниц для отображения
    let pagesToShow = pages.reduce<Array<{ ellipsis: boolean; targetPage: number }>>((finalArr, page) => {
        if (
            page === 1 ||
            page === totalPages ||
            (page >= activePage - maxPagesToShow && page <= activePage + maxPagesToShow)
        ) {
            finalArr.push({ ellipsis: false, targetPage: page });
        }

        return finalArr;
    }, []);

    // Добавление маркеров пропущенных страниц ("...")
    pagesToShow = pagesToShow.reduce<Array<{ ellipsis: boolean; targetPage: number }>>((finalArr, page, idx, arr) => {
        if (idx !== 0 && page.targetPage - arr[idx - 1].targetPage > 1) {
            let targetPage = (page.targetPage + arr[idx - 1].targetPage) / 2;

            finalArr.push({ ellipsis: true, targetPage: Math.round(targetPage) });
        }

        finalArr.push({ ellipsis: false, targetPage: page.targetPage });

        return finalArr;
    }, []);

    return pagesToShow;
}
