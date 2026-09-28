/* ---------- workflow icons (phases and stages), inline SVG: no image or font requests ---------- */
/* exported WF_ICONS, wfIcon */
const WF_ICONS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>',
  document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  check_badge: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16 9.6"/>',
  hard_hat: '<path d="M4 17h16v2H4zM5 17a7 7 0 0 1 14 0"/><path d="M10 10V6h4v4"/>',
  magnifier: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  drafting: '<path d="M4 20l8-16 8 16z"/><path d="M8 14h8M12 4v16"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  people_check: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15 13.5l2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  house: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  frame: '<path d="M4 20V8l8-4 8 4v12"/><path d="M4 12h16M9 8v12M15 8v12"/>',
  pipes: '<path d="M4 7h7a4 4 0 0 1 4 4v9"/><path d="M4 11h7v9"/><circle cx="18" cy="6" r="2"/>',
  building: '<path d="M5 21V5l7-2v18M12 7l7 3v11"/><path d="M8 8v.5M8 12v.5M8 16v.5M15 13v.5M15 17v.5M3 21h18"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
  sheet: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 14h8M8 17h5"/>',
  surveyor: '<path d="M12 4v5M8 21l4-12 4 12M6 21h2M16 21h2"/><rect x="9" y="3" width="6" height="3" rx="1"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12l2 2 4-4"/>',
  city: '<path d="M3 21V10l5-3v14M8 21V4h8v17M16 21v-9l5 2v7M3 21h18"/><path d="M11 8h2M11 11h2M11 14h2"/>',
  sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 11h4v4h10v-4h4v7H3zM5 18v2M19 18v2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>'
};
const wfIcon = (name, cls = 'wi') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${WF_ICONS[name] || WF_ICONS.folder}</svg>`;
