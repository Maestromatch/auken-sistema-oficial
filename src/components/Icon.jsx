export default function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.5 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };

  const paths = {
    metrics: <><path d="M2 13V3" /><path d="M2 13h12" /><rect x="4" y="8" width="2" height="4" /><rect x="7.5" y="5" width="2" height="7" /><rect x="11" y="9" width="2" height="3" /></>,
    chat: <path d="M2 6.5C2 4 4 2.5 6.5 2.5h3C12 2.5 14 4 14 6.5v1C14 10 12 11.5 9.5 11.5H7l-3 2.5v-2.5C3 11 2 9.5 2 7.5z" />,
    users: <><circle cx="6" cy="6" r="2.5" /><path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5" /><path d="M11 6.5a2 2 0 1 0 0-4" /><path d="M13.5 12.5c0-1.5-1-2.8-2.5-3.2" /></>,
    calendar: <><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11" /><path d="M5.5 2v3M10.5 2v3" /></>,
    settings: <><circle cx="8" cy="8" r="2" /><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M5.4 10.6l-1 1M12.6 12.6l-1-1M5.4 5.4l-1-1" /></>,
    search: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 13.5 13.5" /></>,
    plus: <path d="M8 3v10M3 8h10" />,
    check: <path d="M3 8.5 6.5 12 13 4.5" />,
    x: <path d="M4 4l8 8M12 4l-8 8" />,
    bot: <><rect x="3" y="5" width="10" height="8" rx="2" /><circle cx="6" cy="9" r="0.8" fill={color} stroke="none" /><circle cx="10" cy="9" r="0.8" fill={color} stroke="none" /><path d="M8 2v3M5.5 13v1.5M10.5 13v1.5" /></>,
    bolt: <><path d="M9 1.5 3 9h4l-1 5.5L13 7H8.5L9 1.5z" fill={color} fillOpacity="0.15" /><path d="M9 1.5 3 9h4l-1 5.5L13 7H8.5L9 1.5z" /></>,
    money: <><circle cx="8" cy="8" r="6" /><path d="M8 5v6M6 6.5h3a1.25 1.25 0 0 1 0 2.5H7a1.25 1.25 0 0 0 0 2.5h3" /></>,
    phone: <path d="M3.5 2.5h2L7 6 5.5 7c.5 1.5 2 3 3.5 3.5L10 9l3.5 1.5v2c0 .5-.5 1-1 1-5.5 0-10-4.5-10-10 0-.5.5-1 1-1z" />,
    eye: <><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></>,
    edit: <><path d="M11.5 2.5l2 2L5 13l-3 .5.5-3z" /><path d="M9.5 4.5l2 2" /></>,
    trash: <><path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5v9a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-9" /></>,
    bell: <><path d="M4 11V7.5a4 4 0 1 1 8 0V11l1 1.5H3z" /><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" /></>,
    cmd: <><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="M6 5l4 3-4 3" /></>,
    refresh: <><path d="M13 5a5 5 0 0 0-8.5-2.5L3 4" /><path d="M3 2v2h2" /><path d="M3 11a5 5 0 0 0 8.5 2.5L13 12" /><path d="M13 14v-2h-2" /></>,
    camera: <><path d="M5.5 4 6.5 2.5h3L10.5 4H13a1.5 1.5 0 0 1 1.5 1.5V12A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V5.5A1.5 1.5 0 0 1 3 4z" /><circle cx="8" cy="8.5" r="2.5" /></>,
    file: <><path d="M4 1.5h5l3 3v10H4z" /><path d="M9 1.5v3h3" /><path d="M6 8h4M6 10.5h4" /></>,
    warning: <><path d="M8 2 14 13H2z" /><path d="M8 6v3M8 11.5h.01" /></>,
  };

  return <svg {...props}>{paths[name] || paths.cmd}</svg>;
}
