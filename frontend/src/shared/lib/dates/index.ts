import { withLeadingZero } from '../strings';

export const formatDate = (date: Date, separator = '.') => {
    return [withLeadingZero(date.getDate()), withLeadingZero(date.getMonth() + 1), date.getFullYear()].join(separator);
};
