// Every downloaded resume is named UUV-{user}_{resume name}_{timestamp},
// for example "UUV-Jane_Doe_Navy_Pro_20261103-142530"

const clean = (part) => String(part || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().replace(/\s+/g, "_");
const pad = (number) => String(number).padStart(2, "0");

// Local time, sortable: 20261103-142530
const stamp = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

export const resumeFileName = (user, resumeName, date = new Date()) =>
  `UUV-${clean(user) || "User"}_${clean(resumeName) || "Resume"}_${stamp(date)}`;

// The browser names a printed PDF after the page title, so the title is the
// file name while the print dialog is open
export function printAs(name) {
  const pageTitle = document.title;
  document.title = name;
  window.addEventListener("afterprint", () => { document.title = pageTitle; }, { once: true });
  window.print();
}
