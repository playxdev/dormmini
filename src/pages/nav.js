/**
 * Bottom navigation, shared by every authenticated screen.
 *
 * Items without a view are Phase 2 work not yet built; they render disabled
 * rather than being hidden, so the shell keeps the shape of the final design.
 */

const ICONS = {
  home: '<path d="M12 3 3 10.2V21h6v-5.5h6V21h6V10.2L12 3Z"/>',
  bill: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm2.5 5h7v2h-7V7Zm0 4h7v2h-7v-2Z"/>',
  repair: '<path d="M20 6a5 5 0 0 1-6.6 4.7L6 18l-2-2 7.3-7.4A5 5 0 0 1 16 2l-3 3 3 3 3-3c.6.6 1 1.5 1 2Z"/>',
  menu: '<path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/>',
  scan: '<path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z"/>'
};

const ITEMS = [
  { key: 'home', title: 'หน้าหลัก', view: 'home' },
  { key: 'bill', title: 'บิล', view: 'bills' },
  { key: 'repair', title: 'แจ้งซ่อม' },
  { key: 'menu', title: 'เมนู' }
];

export function navBar(active) {
  const item = (i) => `
    <button class="nav__item${i.view === active ? ' is-active' : ''}" type="button"
      ${i.view ? `data-nav="${i.view}"` : 'disabled aria-disabled="true"'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[i.key]}</svg>
      <span>${i.title}</span>
    </button>`;

  return `
    <nav class="nav" aria-label="เมนูหลัก">
      ${item(ITEMS[0])}
      ${item(ITEMS[1])}
      <button class="nav__fab" type="button" disabled aria-disabled="true">
        <span class="nav__fab-circle">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.scan}</svg>
        </span>
        <span>สแกน/จ่าย</span>
      </button>
      ${item(ITEMS[2])}
      ${item(ITEMS[3])}
    </nav>`;
}

/** Wires every [data-nav] control in a rendered screen to the router. */
export function bindNav(root, navigate) {
  root.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.nav, el.dataset.navParam));
  });
}
