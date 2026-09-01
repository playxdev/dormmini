/**
 * Unauthenticated screen. Single action: log in with LINE.
 */

import { login } from '../auth/line.js';

const FEATURES = [
  {
    tone: 'green',
    title: 'ชำระค่าหอออนไลน์',
    subtitle: 'ปลอดภัย รวดเร็ว',
    icon: '<path d="M12 2 4 5.5v6c0 4.6 3.1 8.6 8 10.5 4.9-1.9 8-5.9 8-10.5v-6L12 2Z"/>'
  },
  {
    tone: 'blue',
    title: 'แจ้งซ่อม ติดตามสถานะ',
    subtitle: 'ได้ตลอดเวลา',
    icon: '<path d="M4 5h16v11H8l-4 4V5Z"/>'
  },
  {
    tone: 'purple',
    title: 'จดมิเตอร์',
    subtitle: 'และประวัติการใช้งาน',
    icon: '<path d="M4 5h16v14H4V5Zm3 10 3-4 2.5 3L16 9l2 5H7Z"/>'
  },
  {
    tone: 'orange',
    title: 'ประกาศและข่าวสาร',
    subtitle: 'ไม่พลาดทุกข้อมูลสำคัญ',
    icon: '<path d="M3 10v4h3l6 4V6L6 10H3Zm14.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z"/>'
  }
];

function featureRow(feature) {
  return `
    <li class="feature">
      <span class="feature__icon feature__icon--${feature.tone}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${feature.icon}</svg>
      </span>
      <span class="feature__text">
        <strong>${feature.title}</strong>
        <small>${feature.subtitle}</small>
      </span>
    </li>`;
}

export function renderLogin(root) {
  root.innerHTML = `
    <main class="screen screen--login">
      <header class="brand">
        <svg class="brand__mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 3 10.2V21h6v-5.5h6V21h6V10.2L12 3Z"/>
        </svg>
        <h1 class="brand__name">dorm.place</h1>
      </header>

      <p class="login__welcome">ยินดีต้อนรับ<br>เข้าสู่ <b>dorm.place</b></p>
      <p class="login__tagline">จัดการหอพักของคุณ<br>ง่าย ครบ จบในที่เดียว</p>

      <img class="login__mascot" src="/assets/mascot.png" alt="" width="120" height="120">

      <ul class="feature-list">${FEATURES.map(featureRow).join('')}</ul>

      <button class="btn btn--line" type="button" id="login-button">
        <span class="btn__line-badge">LINE</span>
        เข้าสู่ระบบด้วย LINE
      </button>

      <p class="login__note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5.5v6c0 4.6 3.1 8.6 8 10.5 4.9-1.9 8-5.9 8-10.5v-6L12 2Z"/></svg>
        ปลอดภัยด้วย LINE Login
      </p>
    </main>`;

  root.querySelector('#login-button').addEventListener('click', login);
}
