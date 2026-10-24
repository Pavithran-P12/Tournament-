// Tournament configuration. Event details come from the published poster.
// Teams and groups below are the official entry list and the random draw done on 22 October 2026 (Beginner Men's redrawn into groups of 6 the same evening).
// Entry list updated 24 October 2026 (organizer's final list). Groups are provisional until the organizer's split is entered.

export const EVENT = {
  name: 'ThirdSpace Play',
  fullName: 'ThirdSpace Play Badminton Tournament',
  organizer: 'ThirdSpace',
  instagram: 'thirdspace_by_losh',
  date: '2026-10-25',
  dateLabel: 'Sunday 25 October 2026',
  dayStart: 9 * 60, // minutes from midnight
  dayEnd: 17 * 60, // times are tentative; the day may run past 4 PM
  venue: 'Rapid Sports Academy',
  area: 'Perungudi, Chennai',
  courts: 5,
  // false shows a "Sample draw" notice on every page.
  drawPublished: true,
  leagueSlot: 12, // minutes per league match slot (15-point game plus changeover)
  knockoutStart: 14 * 60, // quarter-finals, semi-finals and finals from 2 PM at the earliest
  knockoutBreak: 10, // minutes between the last league match and the first knockout if the league runs past knockoutStart
  // Official session windows from the organizer. Players should reach the venue reportBefore minutes early.
  sessions: [
    { key: 'beginner', label: 'Beginner league', cats: ['BMD', 'BWD'], start: 9 * 60, end: 11 * 60, detail: "Beginner Men's and Beginner Women's league matches" },
    { key: 'intermediate', label: 'Intermediate league', cats: ['IMD', 'IXD'], start: 10 * 60 + 45, end: 13 * 60, detail: "Intermediate Mixed and Intermediate Men's league matches" },
    { key: 'knockout', label: 'Knockouts', cats: [], start: 14 * 60, end: 16 * 60, detail: 'Quarter-finals, semi-finals and finals' },
  ],
  reportBefore: 30, // minutes before the category's start time
  calledWithin: 5, // minutes after being called before a walkover may be given
  strictOrder: false, // true: a match never starts before any lower number in its category (leaves courts idle); false: in order within each pool
  timesTentative: true, // shows "times are tentative" on the schedule
  quarterSlot: 16, // minutes per quarter-final (single game to 21, plus changeover)
  knockoutSlot: 32, // minutes per semi-final or final (best of 3 games to 21, plus changeover)
  knockoutRest: 0, // extra minutes between a team's knockout matches
  knockoutWait: 0, // minutes a knockout match may be held back to avoid a player needed on two courts
  firstServer: 'A',
  includes: [
    { title: 'Yonex Mavis 350', detail: 'Nylon shuttles for every match' },
    { title: 'Refreshments', detail: 'Through the day at the venue' },
    { title: 'Trophies', detail: 'Winner and runner-up in every category' },
  ],
  // Official rules from the organizer (24 Oct), then the eligibility and conduct rules from the poster.
  rules: [
    "Reporting time: all players must report at least 30 minutes before their category's scheduled start time (Beginners by 8:30 AM, Intermediate by 10:15 AM, knockouts by 1:30 PM).",
    'Match start: matches start strictly on time. Players must be ready when called.',
    'Pool stage: league format within each pool, each match played to 15 points (rally scoring, golden point at 14–14).',
    'Knockout qualification: the top 2 teams from each pool qualify for the knockout round, as per the published fixture format.',
    'Semi-finals and finals: played to 21 points (golden point at 20–20). Quarter-finals are one game to 21.',
    'Late arrival or no-show: teams that fail to report when called may forfeit the match. If a team does not arrive within 5 minutes of being called, a walkover may be awarded to the opposing team.',
    "Umpire's decision: the umpire's decision on on-court calls is final.",
    'Beginner: players with little or no tournament experience. Intermediate: players with tournament experience who have never won or been runner-up in a tournament. Open, advanced, district, state or national-level players are not eligible.',
    'Non-marking badminton shoes are compulsory. Players must respect opponents, officials and the venue.',
    'The winner and runner-up of each category receive trophies.',
  ],
};

// Knockout formats:
//   qf     top two of 4 groups -> quarter-finals (A1 v B2, C1 v D2, B1 v A2, D1 v C2) -> semi-finals -> final
//   final2 single group -> 1st v 2nd in the final
// numbered: league matches carry the organizer's match numbers (in pairings order).
// startAt: the earliest time (minutes from midnight) the category's league matches can start. Earlier categories get
// courts first; minCourts guarantees a category that many courts once it has started.
export const CATEGORIES = [
  { code: 'BMD', name: "Beginner Men's Doubles", short: "Beginner Men's", level: 'Beginner', format: 'qf', startAt: 9 * 60, numbered: true,
    groups: { A: ['BMD-01', 'BMD-02', 'BMD-03', 'BMD-04', 'BMD-05', 'BMD-06'], B: ['BMD-07', 'BMD-08', 'BMD-09', 'BMD-10', 'BMD-11', 'BMD-12'], C: ['BMD-13', 'BMD-14', 'BMD-15', 'BMD-16', 'BMD-17', 'BMD-18'], D: ['BMD-19', 'BMD-20', 'BMD-21', 'BMD-22', 'BMD-23', 'BMD-24'] },
    // Organizer's fixtures (24 Oct): full round robin, matches 1-60 in this order, 3 per round.
    pairings: {
      A: [[['BMD-01', 'BMD-06'], ['BMD-02', 'BMD-05'], ['BMD-03', 'BMD-04']], [['BMD-01', 'BMD-05'], ['BMD-06', 'BMD-04'], ['BMD-02', 'BMD-03']], [['BMD-01', 'BMD-04'], ['BMD-05', 'BMD-03'], ['BMD-06', 'BMD-02']], [['BMD-01', 'BMD-03'], ['BMD-04', 'BMD-02'], ['BMD-05', 'BMD-06']], [['BMD-01', 'BMD-02'], ['BMD-03', 'BMD-06'], ['BMD-04', 'BMD-05']]],
      B: [[['BMD-07', 'BMD-12'], ['BMD-08', 'BMD-11'], ['BMD-09', 'BMD-10']], [['BMD-07', 'BMD-11'], ['BMD-12', 'BMD-10'], ['BMD-08', 'BMD-09']], [['BMD-07', 'BMD-10'], ['BMD-11', 'BMD-09'], ['BMD-12', 'BMD-08']], [['BMD-07', 'BMD-09'], ['BMD-10', 'BMD-08'], ['BMD-11', 'BMD-12']], [['BMD-07', 'BMD-08'], ['BMD-09', 'BMD-12'], ['BMD-10', 'BMD-11']]],
      C: [[['BMD-13', 'BMD-18'], ['BMD-14', 'BMD-17'], ['BMD-15', 'BMD-16']], [['BMD-13', 'BMD-17'], ['BMD-18', 'BMD-16'], ['BMD-14', 'BMD-15']], [['BMD-13', 'BMD-16'], ['BMD-17', 'BMD-15'], ['BMD-18', 'BMD-14']], [['BMD-13', 'BMD-15'], ['BMD-16', 'BMD-14'], ['BMD-17', 'BMD-18']], [['BMD-13', 'BMD-14'], ['BMD-15', 'BMD-18'], ['BMD-16', 'BMD-17']]],
      D: [[['BMD-19', 'BMD-24'], ['BMD-20', 'BMD-23'], ['BMD-21', 'BMD-22']], [['BMD-19', 'BMD-23'], ['BMD-24', 'BMD-22'], ['BMD-20', 'BMD-21']], [['BMD-19', 'BMD-22'], ['BMD-23', 'BMD-21'], ['BMD-24', 'BMD-20']], [['BMD-19', 'BMD-21'], ['BMD-22', 'BMD-20'], ['BMD-23', 'BMD-24']], [['BMD-19', 'BMD-20'], ['BMD-21', 'BMD-24'], ['BMD-22', 'BMD-23']]],
    } },
  { code: 'BWD', name: "Beginner Women's Doubles", short: "Beginner Women's", level: 'Beginner', format: 'final2', startAt: 9 * 60, numbered: true,
    groups: { A: ['BWD-01', 'BWD-02', 'BWD-03', 'BWD-04', 'BWD-05', 'BWD-06'] },
    // Organizer's fixture sheet (24 Oct, evening): 6 teams, full round robin, matches 1-15 in this order, 3 per round.
    pairings: {
      A: [[['BWD-01', 'BWD-06'], ['BWD-02', 'BWD-05'], ['BWD-03', 'BWD-04']], [['BWD-01', 'BWD-05'], ['BWD-06', 'BWD-04'], ['BWD-02', 'BWD-03']], [['BWD-01', 'BWD-04'], ['BWD-05', 'BWD-03'], ['BWD-06', 'BWD-02']], [['BWD-01', 'BWD-03'], ['BWD-04', 'BWD-02'], ['BWD-05', 'BWD-06']], [['BWD-01', 'BWD-02'], ['BWD-03', 'BWD-06'], ['BWD-04', 'BWD-05']]],
    } },
  { code: 'IMD', name: "Intermediate Men's Doubles", short: "Intermediate Men's", level: 'Intermediate', format: 'qf', startAt: 10 * 60 + 45, minCourts: 1, numbered: true,
    groups: { A: ['IMD-01', 'IMD-02', 'IMD-03', 'IMD-04', 'IMD-05'], B: ['IMD-06', 'IMD-07', 'IMD-08', 'IMD-09', 'IMD-10'], C: ['IMD-11', 'IMD-12', 'IMD-13', 'IMD-14', 'IMD-15'], D: ['IMD-16', 'IMD-17', 'IMD-18', 'IMD-19', 'IMD-20'] },
    // Organizer's fixtures (24 Oct): full round robin, matches 1-40 in this order, 2 per round (one team rests).
    pairings: {
      A: [[['IMD-01', 'IMD-02'], ['IMD-03', 'IMD-04']], [['IMD-01', 'IMD-03'], ['IMD-02', 'IMD-05']], [['IMD-01', 'IMD-04'], ['IMD-03', 'IMD-05']], [['IMD-01', 'IMD-05'], ['IMD-02', 'IMD-04']], [['IMD-02', 'IMD-03'], ['IMD-04', 'IMD-05']]],
      B: [[['IMD-06', 'IMD-07'], ['IMD-08', 'IMD-09']], [['IMD-06', 'IMD-08'], ['IMD-07', 'IMD-10']], [['IMD-06', 'IMD-09'], ['IMD-08', 'IMD-10']], [['IMD-06', 'IMD-10'], ['IMD-07', 'IMD-09']], [['IMD-07', 'IMD-08'], ['IMD-09', 'IMD-10']]],
      C: [[['IMD-11', 'IMD-12'], ['IMD-13', 'IMD-14']], [['IMD-11', 'IMD-13'], ['IMD-12', 'IMD-15']], [['IMD-11', 'IMD-14'], ['IMD-13', 'IMD-15']], [['IMD-11', 'IMD-15'], ['IMD-12', 'IMD-14']], [['IMD-12', 'IMD-13'], ['IMD-14', 'IMD-15']]],
      D: [[['IMD-16', 'IMD-17'], ['IMD-18', 'IMD-19']], [['IMD-16', 'IMD-18'], ['IMD-17', 'IMD-20']], [['IMD-16', 'IMD-19'], ['IMD-18', 'IMD-20']], [['IMD-16', 'IMD-20'], ['IMD-17', 'IMD-19']], [['IMD-17', 'IMD-18'], ['IMD-19', 'IMD-20']]],
    } },
  { code: 'IXD', name: "Intermediate Mixed Doubles", short: "Intermediate Mixed", level: 'Intermediate', format: 'qf', startAt: 10 * 60 + 45, minCourts: 1, numbered: true,
    groups: { A: ['IXD-01', 'IXD-02', 'IXD-03', 'IXD-04'], B: ['IXD-05', 'IXD-06', 'IXD-07', 'IXD-08'], C: ['IXD-09', 'IXD-10', 'IXD-11', 'IXD-12'], D: ['IXD-13', 'IXD-14', 'IXD-15', 'IXD-16'] },
    // Organizer's fixture sheet (24 Oct): full round robin, matches 1-24 in this order, 2 per round.
    pairings: {
      A: [[['IXD-01', 'IXD-04'], ['IXD-02', 'IXD-03']], [['IXD-01', 'IXD-03'], ['IXD-04', 'IXD-02']], [['IXD-01', 'IXD-02'], ['IXD-03', 'IXD-04']]],
      B: [[['IXD-05', 'IXD-08'], ['IXD-06', 'IXD-07']], [['IXD-05', 'IXD-07'], ['IXD-08', 'IXD-06']], [['IXD-05', 'IXD-06'], ['IXD-07', 'IXD-08']]],
      C: [[['IXD-09', 'IXD-12'], ['IXD-10', 'IXD-11']], [['IXD-09', 'IXD-11'], ['IXD-12', 'IXD-10']], [['IXD-09', 'IXD-10'], ['IXD-11', 'IXD-12']]],
      D: [[['IXD-13', 'IXD-16'], ['IXD-14', 'IXD-15']], [['IXD-13', 'IXD-15'], ['IXD-16', 'IXD-14']], [['IXD-13', 'IXD-14'], ['IXD-15', 'IXD-16']]],
    } },
];

// Entry number -> players, numbered as in the organizer's list of 24 October 2026 (each word capitalised).
export const TEAMS = {
  'IMD-01': ["Raj Prabhu", "Anthony Mugilan"],
  'IMD-02': ["Pavan", "Gnalan"],
  'IMD-03': ["Sriharan Boopathi", "Chandru Jeyakannan"],
  'IMD-04': ["Vignesh Subbu", "Arunkumar Ashokkumar"],
  'IMD-05': ["Prathap Karunanithi", "Neel Stewart"],
  'IMD-06': ["Sarvesh Mahalingam", "Harsha Varthanan Shanmugam"],
  'IMD-07': ["Pathmesh Vallarasu", "Arjun Kannan"],
  'IMD-08': ["Gokulnath Kannan", "Manish Aravind AR"],
  'IMD-09': ["Karthik Gopinath", "Gopinath Mani"],
  'IMD-10': ["Savio Marx Sekar", "Balasubramani Kanagasundaram"],
  'IMD-11': ["GokulRaj Raja", "Saran Balasubramaniam"],
  'IMD-12': ["Dhanu Jayan Rajesh", "Mohannedfayaz Zubair"],
  'IMD-13': ["Giridharan Neelakandan", "Satheeshwaran Kothandapani"],
  'IMD-14': ["Kode Balakrishnan", "Gaurishankar Binu T"],
  'IMD-15': ["Senthil Kumar Uthiravel", "Madesh Velmurugan"],
  'IMD-16': ["Natarajan Mani", "Prakash Srinivasan"],
  'IMD-17': ["Maheswaran Muthu", "Rajesh Chinu"],
  'IMD-18': ["Saravanan Sundarababu", "Ishanth Rajagopal"],
  'IMD-19': ["Lokesh Aarumugam", "Nithin Dinesh"],
  'IMD-20': ["Clifford Sam Noel", "Vignesh Mani"],
  'BMD-01': ["Sathish Krishnamoorthy", "Prajith Nair"],
  'BMD-02': ["Sabarish Prem", "Ravi Raghul. H"],
  'BMD-03': ["Abhishek Vishal", "Zolo Rohith"],
  'BMD-04': ["Fathah Shaikna Lebbai", "Mohideen Thamby"],
  'BMD-05': ["Prabhakaran Kumarapandiyan", "Bhuvaneshwaran Krishnan"],
  'BMD-06': ["Daniel Raj Kalaimani", "Mukundhan Thangaraj"],
  'BMD-07': ["Sharath Baskar", "Kamesh Sivakumar"],
  'BMD-08': ["Manikandan", "Dhamodharan"],
  'BMD-09': ["Yuvanath Mathivanan", "Nikish Anand Bala Thiruvalluvar"],
  'BMD-10': ["Senadhian Gnanasekar", "Giridharan Selvam"],
  'BMD-11': ["Ashokraju Anandharaj", "Tamilselvan Venkatachalam"],
  'BMD-12': ["Venkat Raman Muthusamy", "Praveen Kumar Ethiendran"],
  'BMD-13': ["Rahul Balaji", "D Britto Baskar"],
  'BMD-14': ["Essel Rodney Morais", "Abbilashh Muthu Vijayan"],
  'BMD-15': ["Subin Prakash Jayaprakash", "Aswin Balakrishnan"],
  'BMD-16': ["Manikandan Bose", "Hariprasath Venkatesan Kumar"],
  'BMD-17': ["Harihara Sudan", "Sundara Ganapathy"],
  'BMD-18': ["Madhan Kumar Siva", "Saravana Srinivasan"],
  'BMD-19': ["Lokesh Venkatesan", "Arun Venkatesan"],
  'BMD-20': ["Mohamed Ashiq PA", "Lokeshwaran Selvaraj"],
  'BMD-21': ["Ragul I Selvaraju", "Midhun K Mohandas"],
  'BMD-22': ["Shaik Ali Mohideen", "Mohamed Ali Siddique"],
  'BMD-23': ["Yogeshwaran Muruganandham", "Praveen Sangeeth Raj Nixon"],
  'BMD-24': ["Prasanna Vignesg Ravichandran", "Ashwin Kumar"],
  'IXD-01': ["Faheema Kattakath Sanil", "Sai Rakesh Marlapati"],
  'IXD-02': ["Muthu Padmanaban", "Mamdha Shanmugam"],
  'IXD-03': ["Yogarajan Muthurajan", "Nandhini Kamalam"],
  'IXD-04': ["Sathishkumar Krishnamoorthy", "Poorvaja Ganesh"],
  'IXD-05': ["Pavan Kumar", "Parvathy Shankar"],
  'IXD-06': ["Girither Sakthi", "Pooja Elumalai"],
  'IXD-07': ["Sarvesh S Mahalingam", "Jayalakshmi Kasinathan"],
  'IXD-08': ["Praveen Kumar Ethiendran", "Roshini Sathish"],
  'IXD-09': ["Shanthi Narasimharao", "Sidharth Agarwal"],
  'IXD-10': ["Gowri Arjunan", "Prakash Srinivasan"],
  'IXD-11': ["Princy Jessica", "Mahibalakrishna Aswin"],
  'IXD-12': ["Koushika Thangavelu", "Jebastin Irudhaya"],
  'IXD-13': ["Purusothaman Sathyendran", "Ansuha Chowdary Nithyananda"],
  'IXD-14': ["Vidhya Parthasarathy", "Saravanan Sundarababu"],
  'IXD-15': ["Madesh Velmurugan", "Ashrita Sathish"],
  'IXD-16': ["Biswaranjan Behera", "Aneesha Alex"],
  'BWD-01': ["Kalai", "Oviya"],
  'BWD-02': ["Gowri Arjunan", "Shanthi Narasimharao"],
  'BWD-03': ["Prathiba Ramesh Kumar", "Diya Ravishankar"],
  'BWD-04': ["Sangeetha PK", "Lakshmi Chaganti"],
  'BWD-05': ["SeemaFirdaus", "Shubashini Govindarajan"],
  'BWD-06': ["Suganthi V", "T Vidya"],
};

// Different spellings of the same person across categories (lower case), so the
// schedule never puts one person on two courts at once.
export const SAME_PERSON = {
  'pavan kumar': 'pavan',
  'sathishkumar krishnamoorthy': 'sathish krishnamoorthy',
  'sarvesh s mahalingam': 'sarvesh mahalingam',
};

// Small seeded PRNG, used only for simulated previews and tests.
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

