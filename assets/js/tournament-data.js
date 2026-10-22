// Tournament configuration. Event details come from the published poster.
// Teams and groups below are the official entry list and the random draw done on 22 October 2026 (Beginner Men's redrawn into groups of 6 the same evening).

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
  courts: 5,
  // false shows a "Sample draw" notice on every page.
  drawPublished: true,
  leagueSlot: 14, // minutes per league match slot (15-point game plus changeover)
  knockoutSlot: 35, // minutes per knockout slot (best of 3 games to 21, plus changeover)
  firstServer: 'A',
  includes: [
    { title: 'Yonex Mavis 350', detail: 'Nylon shuttles for every match' },
    { title: 'Refreshments', detail: 'Through the day at the venue' },
    { title: 'Trophies', detail: 'Winner and runner-up in every category' },
  ],
  rules: [
    'Every team plays 3 league matches. League matches are a single game to 15 points. Knockout matches are best of 3 games to 21 points. Rally scoring, with a golden point instead of deuce.',
    'Beginner: players with little or no tournament experience. Intermediate: players with tournament experience who have never won or been runner-up in a tournament.',
    'Open or advanced players, district, state or national-level players and tournament winners or runners-up are not eligible. If found, they will be removed from the tournament with no refund.',
    'Players must play in the correct category for their level. Incorrect level declaration may result in disqualification.',
    'Players must report 30 minutes before their scheduled match. Late arrival may result in a walkover. Non-marking badminton shoes are compulsory.',
    'Players must respect opponents, officials and the venue. Abusive or unsportsmanlike behaviour will not be tolerated.',
    "The referee's decision is final. Players must follow the official match schedule. No replay will be given for missed matches.",
    'The winner and runner-up of each category will receive trophies. All players are expected to have read, understood and agreed to these rules.',
  ],
};

// Knockout formats:
//   qf8    6 group winners + 2 best runners-up -> quarter-finals -> semi-finals -> final (not used now)
//   sf4    4 group winners -> semi-finals (A1 v C1, B1 v D1) -> final
//   final2 single group -> 1st v 2nd in the final
export const CATEGORIES = [
  { code: 'BMD', name: "Beginner Men's Doubles", short: "Beginner Men's", level: 'Beginner', format: 'sf4',
    groups: { A: ['BMD-06', 'BMD-12', 'BMD-04', 'BMD-10', 'BMD-01', 'BMD-08'], B: ['BMD-20', 'BMD-21', 'BMD-16', 'BMD-14', 'BMD-24', 'BMD-02'], C: ['BMD-18', 'BMD-19', 'BMD-07', 'BMD-03', 'BMD-22', 'BMD-11'], D: ['BMD-23', 'BMD-15', 'BMD-13', 'BMD-17', 'BMD-05', 'BMD-09'] },
    // Groups of 6 where each team plays only 3 randomly drawn opponents (3 rounds, no repeats).
    pairings: {
      A: [[['BMD-08', 'BMD-12'], ['BMD-04', 'BMD-10'], ['BMD-06', 'BMD-01']], [['BMD-01', 'BMD-12'], ['BMD-04', 'BMD-08'], ['BMD-06', 'BMD-10']], [['BMD-06', 'BMD-12'], ['BMD-01', 'BMD-04'], ['BMD-10', 'BMD-08']]],
      B: [[['BMD-20', 'BMD-21'], ['BMD-24', 'BMD-16'], ['BMD-14', 'BMD-02']], [['BMD-16', 'BMD-21'], ['BMD-14', 'BMD-20'], ['BMD-24', 'BMD-02']], [['BMD-14', 'BMD-24'], ['BMD-21', 'BMD-02'], ['BMD-16', 'BMD-20']]],
      C: [[['BMD-07', 'BMD-03'], ['BMD-18', 'BMD-19'], ['BMD-22', 'BMD-11']], [['BMD-07', 'BMD-22'], ['BMD-18', 'BMD-03'], ['BMD-19', 'BMD-11']], [['BMD-11', 'BMD-03'], ['BMD-18', 'BMD-07'], ['BMD-22', 'BMD-19']]],
      D: [[['BMD-15', 'BMD-13'], ['BMD-09', 'BMD-05'], ['BMD-17', 'BMD-23']], [['BMD-05', 'BMD-17'], ['BMD-15', 'BMD-23'], ['BMD-13', 'BMD-09']], [['BMD-15', 'BMD-05'], ['BMD-13', 'BMD-23'], ['BMD-09', 'BMD-17']]],
    } },
  { code: 'BWD', name: "Beginner Women's Doubles", short: "Beginner Women's", level: 'Beginner', format: 'final2',
    groups: { A: ['BWD-02', 'BWD-01', 'BWD-04', 'BWD-03'] } },
  { code: 'IMD', name: "Intermediate Men's Doubles", short: "Intermediate Men's", level: 'Intermediate', format: 'sf4',
    groups: { A: ['IMD-10', 'IMD-09', 'IMD-04', 'IMD-13', 'IMD-05', 'IMD-02'], B: ['IMD-06', 'IMD-01', 'IMD-16', 'IMD-07'], C: ['IMD-17', 'IMD-03', 'IMD-14', 'IMD-15'], D: ['IMD-12', 'IMD-11', 'IMD-18', 'IMD-08'] },
    // Group A has 6 teams, each playing 3 randomly drawn opponents (IMD-02 moved from group B by random draw).
    pairings: {
      A: [[['IMD-10', 'IMD-09'], ['IMD-02', 'IMD-05'], ['IMD-13', 'IMD-04']], [['IMD-13', 'IMD-10'], ['IMD-02', 'IMD-04'], ['IMD-05', 'IMD-09']], [['IMD-09', 'IMD-13'], ['IMD-02', 'IMD-10'], ['IMD-04', 'IMD-05']]],
    } },
  { code: 'IXD', name: "Intermediate Mixed Doubles", short: "Intermediate Mixed", level: 'Intermediate', format: 'sf4',
    groups: { A: ['IXD-07', 'IXD-11', 'IXD-13', 'IXD-14'], B: ['IXD-01', 'IXD-05', 'IXD-04', 'IXD-08'], C: ['IXD-06', 'IXD-17', 'IXD-12', 'IXD-16'], D: ['IXD-10', 'IXD-15', 'IXD-03', 'IXD-02'] } },
];

// Knockout running order. Categories that share players never play knockouts in the same slot.
export const KNOCKOUT_SLOTS = [
  ['BMD-SF1', 'BMD-SF2', 'IMD-SF1', 'IMD-SF2', 'BWD-F'],
  ['IXD-SF1', 'IXD-SF2'],
  ['BMD-F', 'IMD-F'],
  ['IXD-F'],
];

// Entry number -> players, spelled as given by the organizer (each word capitalised). IXD-09 was a duplicate of IXD-06 and is removed.
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
  'IMD-13': ["Giridharan Neelakandan", "Sateeshwaran Kothandaraman"],
  'IMD-14': ["Kode Balakrishnan", "Gaurishankar Binu T"],
  'IMD-15': ["Senthil Kumar Uthiravel", "Madesh Velmurugan"],
  'IMD-16': ["Natarajan Mani", "Prakash Srinivasan"],
  'IMD-17': ["Maheswaran Muthu", "Rajesh Chinu"],
  'IMD-18': ["Saravanan Sundarababu", "Ishanth Rajagopal"],
  'BMD-01': ["Sathish Krishnamoorthy", "Prajith Nair"],
  'BMD-02': ["Sabarish Prem", "Ravi Raghul. H"],
  'BMD-03': ["Abhishek Vishal", "Zolo Rohith"],
  'BMD-04': ["Fathah Shaikna Lebbai", "Ismail Mohamed Noohu"],
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
  'IXD-10': ["Shanthi Narasimharao", "Sidharth Agarwal"],
  'IXD-11': ["Gowri Arjunan", "Prakash Srinivasan"],
  'IXD-12': ["Princy Jessica", "Mahibalakrishna Aswin"],
  'IXD-13': ["Koushika Thangavelu", "Jebastin Irudhaya"],
  'IXD-14': ["Purusothaman Sathyendran", "Ansuha Chowdary Nithyananda"],
  'IXD-15': ["Vidhya Parthasarathy", "Saravanan Sundarababu"],
  'IXD-16': ["Madesh Velmurugan", "Ashrita Sathish"],
  'IXD-17': ["Biswaranjan Behera", "Aneesha Alex"],
  'BWD-01': ["Kalai", "Oviya"],
  'BWD-02': ["Gowri Arjunan", "Shanthi Narasimharao"],
  'BWD-03': ["Prathiba Ramesh Kumar", "Diya Ravishankar"],
  'BWD-04': ["Sangeetha PK", "Lakshmi Chaganti"],
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

