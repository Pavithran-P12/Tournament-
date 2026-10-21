// Tournament configuration. Event details come from the published poster.
// Teams below are SAMPLE DATA for the demo; they will be replaced by the real entry list.

export const EVENT = {
  name: 'ThirdSpace Play',
  fullName: 'ThirdSpace Play Badminton Tournament',
  organizer: 'ThirdSpace',
  instagram: 'thirdspace_by_losh',
  date: '2026-10-25',
  dateLabel: 'Sunday 25 October 2026',
  dayStart: 9 * 60, // minutes from midnight
  dayEnd: 16 * 60,
  venue: 'Rapid Sports Academy',
  area: 'Perungudi, Chennai',
  fee: { earlyBird: 599, regular: 699 },
  registrationCloses: '22 October 2026',
  courts: 5, // assumption for the demo, to be confirmed with the venue
  leagueSlot: 15, // minutes per league match slot
  knockoutSlot: 20,
  firstServer: 'A',
  includes: [
    { title: 'Yonex Mavis 350', detail: 'Nylon shuttles for every match' },
    { title: 'Refreshments', detail: 'Through the day at the venue' },
    { title: 'Trophies', detail: 'Winner and runner-up in every category' },
  ],
  rules: [
    'Every team plays 3 league matches. League matches are played to 15 points and knockout matches to 21, using rally scoring.',
    'Beginner: players with little or no tournament experience. Intermediate: players with tournament experience who have never won or been runner-up in a tournament.',
    'Open or advanced players, district, state or national-level players and tournament winners or runners-up are not eligible. If found, they will be removed from the tournament with no refund.',
    'Players must register under the correct playing category. Incorrect level declaration may result in disqualification.',
    'Players must report 30 minutes before their scheduled match. Late arrival may result in a walkover. Non-marking badminton shoes are compulsory.',
    'Players must respect opponents, officials and the venue. Abusive or unsportsmanlike behaviour will not be tolerated.',
    "The referee's decision is final. Players must follow the official match schedule. No replay will be given for missed matches.",
    'The winner and runner-up of each category will receive trophies. By registering, players confirm that they have read, understood and agreed to all tournament rules.',
  ],
};

// Group sizes per category. A 3-team group plays 2 matches per team.
export const CATEGORIES = [
  { code: 'BMD', name: "Beginner Men's Doubles", short: "Beginner Men's", level: 'Beginner', mix: ['m', 'm'], groups: [4, 4, 4, 4] },
  { code: 'BWD', name: "Beginner Women's Doubles", short: "Beginner Women's", level: 'Beginner', mix: ['f', 'f'], groups: [4, 4, 4, 3] },
  { code: 'IMD', name: "Intermediate Men's Doubles", short: "Intermediate Men's", level: 'Intermediate', mix: ['m', 'm'], groups: [4, 4, 3, 4] },
  { code: 'IXD', name: 'Intermediate Mixed Doubles', short: 'Intermediate Mixed', level: 'Intermediate', mix: ['m', 'f'], groups: [4, 3, 4, 4] },
];

export const GROUP_LETTERS = ['A', 'B', 'C', 'D'];

// Semi-final pairings agreed with the organizer.
export const SEMIS = [
  { id: 'SF1', a: 'A', b: 'C' },
  { id: 'SF2', a: 'B', b: 'D' },
];

const MEN = ['Arjun', 'Karthik', 'Vignesh', 'Pradeep', 'Siddharth', 'Rahul', 'Naveen', 'Ashwin', 'Harish', 'Gokul', 'Dinesh', 'Surya', 'Manoj', 'Bharath', 'Vikram', 'Sanjay', 'Prakash', 'Hari', 'Rohit', 'Kiran', 'Sathish', 'Ajay', 'Deepak', 'Varun', 'Aravind', 'Ganesh', 'Mukesh', 'Nikhil', 'Ramesh', 'Tarun', 'Yuvan', 'Abishek', 'Balaji', 'Jagan', 'Lokesh', 'Madhan', 'Nithin', 'Pranav', 'Raghav', 'Shyam'];
const WOMEN = ['Divya', 'Priya', 'Keerthana', 'Swathi', 'Anitha', 'Meera', 'Nandhini', 'Shruti', 'Kavya', 'Lakshmi', 'Harini', 'Janani', 'Pooja', 'Sowmya', 'Aishwarya', 'Deepika', 'Gayathri', 'Ishwarya', 'Monisha', 'Ramya', 'Sangeetha', 'Varsha', 'Yamini', 'Akshaya', 'Bhavana', 'Charulatha', 'Dharani', 'Hema', 'Kaviya', 'Nivetha'];

// Small seeded PRNG so the sample data is identical on every device.
export function rng(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let s = h >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sample teams per category, already split into groups. */
export function sampleTeams(cat) {
  const rand = rng(`teams-${cat.code}`);
  const total = cat.groups.reduce((s, n) => s + n, 0);
  const pools = { m: shuffled(MEN, rand), f: shuffled(WOMEN, rand) };
  const used = { m: 0, f: 0 };
  const teams = [];
  for (let i = 0; i < total; i++) {
    const p1 = pools[cat.mix[0]][used[cat.mix[0]]++];
    const p2 = pools[cat.mix[1]][used[cat.mix[1]]++];
    teams.push({ id: `${cat.code}-T${String(i + 1).padStart(2, '0')}`, players: [p1, p2], name: `${p1} & ${p2}`, rating: rand() });
  }
  const groups = {};
  let k = 0;
  cat.groups.forEach((size, gi) => {
    groups[GROUP_LETTERS[gi]] = teams.slice(k, k + size);
    k += size;
  });
  return groups;
}
