// Anonymous feedback: a small button on every page opens three quick ratings and one optional comment.
// Answers are emailed through Web3Forms (a form-to-email service), so no email address sits in this
// public repo. Nothing personal is asked for or added: no name, email, phone, team or match.
// To connect it, create a free access key at https://web3forms.com with the organizer's email and
// paste it below. The key is designed to be public; it only allows sending to that inbox.
const ACCESS_KEY = '246796a9-7004-4370-a87c-e6db0bd292e1';
const ENDPOINT = 'https://api.web3forms.com/submit';
const SENT_KEY = 'tsp-feedback-sent'; // remembered on this device only, to show "thanks" instead of the form again

const QUESTIONS = [
  { name: 'excitement', label: 'How excited are you for the tournament?', scale: ['😐', '🙂', '😀', '🤩', '🔥'], words: ['Meh', 'A little', 'Excited', 'Very', 'Can’t wait'] },
  { name: 'experience', label: 'Played already? How was it?', scale: ['😕', '😐', '🙂', '😀', '🤩'], words: ['Poor', 'Okay', 'Good', 'Great', 'Loved it'], skip: 'Not played yet' },
  { name: 'website', label: 'Your name on a tournament website, live scores, sharing your result: how does it feel?', scale: ['😐', '🙂', '😀', '🤩', '🔥'], words: ['Meh', 'Nice', 'Cool', 'Love it', 'Next level'] },
];

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

function scaleHtml(q) {
  const opts = q.scale.map((emoji, i) => `<label class="fb-opt" title="${q.words[i]}">
      <input type="radio" name="${q.name}" value="${i + 1} – ${q.words[i]}"><span class="fb-emoji" aria-hidden="true">${emoji}</span><span class="fb-word">${q.words[i]}</span>
    </label>`).join('');
  const skip = q.skip ? `<label class="fb-opt fb-skip"><input type="radio" name="${q.name}" value="${q.skip}"><span class="fb-word">${q.skip}</span></label>` : '';
  return `<fieldset class="fb-q"><legend>${q.label}</legend><div class="fb-scale">${opts}</div>${skip}</fieldset>`;
}

function mount() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fb-fab';
  btn.innerHTML = '<span aria-hidden="true">💬</span> Feedback';
  const dialog = document.createElement('dialog');
  dialog.className = 'fb-dialog';
  dialog.setAttribute('aria-labelledby', 'fb-title');
  dialog.innerHTML = `
    <form class="fb-form" novalidate>
      <div class="fb-head">
        <h2 id="fb-title">Quick feedback</h2>
        <button type="button" class="fb-close" aria-label="Close">×</button>
      </div>
      <p class="fb-note">Anonymous. No name, email or phone is asked for. Takes 20 seconds.</p>
      ${QUESTIONS.map(scaleHtml).join('')}
      <label class="fb-q fb-text">
        <span class="fb-legend">Anything for the organisers or the website? <em>(optional)</em></span>
        <textarea name="comments" rows="3" maxlength="400" placeholder="Short and honest is perfect"></textarea>
      </label>
      <input type="checkbox" name="botcheck" class="fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="fb-status" role="status" aria-live="polite"></p>
      <button type="submit" class="btn btn-block fb-send">Send feedback</button>
    </form>
    <div class="fb-thanks" hidden>
      <p class="fb-big" aria-hidden="true">🏸</p>
      <h2>Thank you!</h2>
      <p>Your feedback is on its way to the organisers.</p>
      <button type="button" class="btn fb-close">Close</button>
    </div>`;
  document.body.append(btn, dialog);

  const form = dialog.querySelector('form');
  const thanks = dialog.querySelector('.fb-thanks');
  const status = dialog.querySelector('.fb-status');
  const showThanks = () => { form.hidden = true; thanks.hidden = false; };

  btn.addEventListener('click', () => {
    if (safe(() => localStorage.getItem(SENT_KEY), null)) showThanks();
    dialog.showModal();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('.fb-close')) dialog.close();
  });

  form.addEventListener('input', () => { if (!form.querySelector('.fb-send').disabled) status.textContent = ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get('botcheck')) return;
    const answers = Object.fromEntries(QUESTIONS.map((q) => [q.name, data.get(q.name) || '']));
    const comments = String(data.get('comments') || '').trim();
    if (!Object.values(answers).some(Boolean) && !comments) {
      status.textContent = 'Tap at least one answer first.';
      return;
    }
    if (!ACCESS_KEY) {
      status.textContent = 'Feedback is not connected yet. Please try again later.';
      return;
    }
    const send = form.querySelector('.fb-send');
    send.disabled = true;
    status.textContent = 'Sending…';
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: 'ThirdSpace Play: anonymous feedback',
          from_name: 'ThirdSpace Play website',
          'Excitement for the tournament': answers.excitement || '–',
          'Experience so far': answers.experience || '–',
          'Website (names, live scores, sharing)': answers.website || '–',
          Comments: comments || '–',
          Page: location.pathname.split('/').pop() || 'index.html',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || 'send failed');
      safe(() => localStorage.setItem(SENT_KEY, '1'));
      form.reset();
      status.textContent = '';
      showThanks();
    } catch {
      status.textContent = 'Could not send right now. Check your connection and try again.';
    } finally {
      send.disabled = false;
    }
  });
}

mount();
