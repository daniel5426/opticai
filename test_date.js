const parseDateFromText = (text) => {
    if (!text.trim()) return null;

    const trimmed = text.trim();

    const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
      const date = new Date(trimmed + "T00:00:00");
      if (!isNaN(date.getTime())) {
        const [y, m, d] = trimmed.split("-").map(Number);
        return {
          date: new Date(y, m - 1, d),
          isoString: trimmed,
        };
      }
    }

    const parts = trimmed.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let day, month, year;

      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }

      if (year < 100) {
        year += 2000;
      }

      if (
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12 &&
        year >= 1900 &&
        year <= 2100
      ) {
        const date = new Date(year, month - 1, day);
        if (
          !isNaN(date.getTime()) &&
          date.getDate() === day &&
          date.getMonth() === month - 1
        ) {
          const isoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          return { date, isoString };
        }
      }
    }

    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const isoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        return { date, isoString };
      }
    } catch {
      return null;
    }

    return null;
};

const formatDateToString = (date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

console.log(parseDateFromText("13/05"));
console.log(formatDateToString(new Date("2024-05-13T00:00:00.000Z")));
