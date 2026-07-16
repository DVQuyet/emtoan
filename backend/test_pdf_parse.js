import * as pdfParse from 'pdf-parse';

console.log("pdfParse namespace type:", typeof pdfParse);
console.log("pdfParse namespace keys:", Object.keys(pdfParse));
console.log("pdfParse.default type:", typeof pdfParse.default);
if (pdfParse.default) {
  console.log("pdfParse.default keys:", Object.keys(pdfParse.default));
}

