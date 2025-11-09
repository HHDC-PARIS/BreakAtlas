function shareSpot(i) {
  const s = spots[i];
  const text = `Check this out on BreakAtlas: ${s.name} — ${s.city}, ${s.country} (${s.type}).`;
  const url = encodeURIComponent(location.href);
  const msg = encodeURIComponent(text);

  if (navigator.share) {
    navigator.share({ title: "BreakAtlas", text, url: location.href }).catch(() => {});
    return;
  }

  const links = {
    twitter: `https://twitter.com/intent/tweet?text=${msg}&url=${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    whatsapp: `https://api.whatsapp.com/send?text=${msg}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${msg}`
  };

  for (const key in links) {
    window.open(links[key], "_blank");
  }

  notify("Shared on social platforms");
  logActivity(`Shared ${s.name} on social platforms`);
}