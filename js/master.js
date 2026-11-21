/**
 * 参考書マスターデータ
 * 問題数を変えたい場合はこのファイルだけ編集すればOKです。
 */
window.CM = (function () {
  const BOOKS = [
    {
      id: "1", numeral: "Ⅰ", name: "青チャートⅠ", short: "Ⅰ",
      example: 194, exercise: 135,
      color: "#2A5BD7", soft: "#E8EEFC",
    },
    {
      id: "A", numeral: "A", name: "青チャートA", short: "A",
      example: 158, exercise: 107,
      color: "#0E8C7F", soft: "#E2F4F1",
    },
    {
      id: "2", numeral: "Ⅱ", name: "青チャートⅡ", short: "Ⅱ",
      example: 262, exercise: 159,
      color: "#5B4BD6", soft: "#ECE9FB",
    },
    {
      id: "B", numeral: "B", name: "青チャートB", short: "B",
      example: 94, exercise: 63,
      color: "#B4760F", soft: "#FBF1DF",
    },
    {
      id: "3", numeral: "Ⅲ", name: "青チャートⅢ", short: "Ⅲ",
      example: 215, exercise: 176,
      color: "#C2456B", soft: "#FBE8EE",
    },
    {
      id: "C", numeral: "C", name: "青チャートC", short: "C",
      example: 179, exercise: 121,
      color: "#3E6B85", soft: "#E7F0F5",
    },
  ];

  const SECTIONS = {
    example: { key: "example", label: "例題", short: "例" },
    exercise: { key: "exercise", label: "EX", short: "EX" },
  };

  const BOOK_MAP = BOOKS.reduce(function (acc, book) {
    acc[book.id] = book;
    return acc;
  }, {});

  function bookById(id) {
    return BOOK_MAP[id] || BOOKS[0];
  }

  function sectionTotal(book, section) {
    return book[section] || 0;
  }

  function bookTotal(book) {
    return book.example + book.exercise;
  }

  const GRAND_TOTAL = BOOKS.reduce(function (sum, book) {
    return sum + bookTotal(book);
  }, 0);

  return {
    BOOKS: BOOKS,
    BOOK_MAP: BOOK_MAP,
    SECTIONS: SECTIONS,
    bookById: bookById,
    sectionTotal: sectionTotal,
    bookTotal: bookTotal,
    GRAND_TOTAL: GRAND_TOTAL,
    EXAMPLE_TOTAL: BOOKS.reduce(function (s, b) { return s + b.example; }, 0),
    EXERCISE_TOTAL: BOOKS.reduce(function (s, b) { return s + b.exercise; }, 0),
  };
})();
