const value = "2024-05-02";
const date = new Date(value);
const day = date.getDate().toString().padStart(2, "0");
const month = (date.getMonth() + 1).toString().padStart(2, "0");
const year = date.getFullYear();
const formatted = `${day}/${month}/${year}`;
console.log(formatted);
