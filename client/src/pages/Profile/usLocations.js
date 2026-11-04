// Location suggestions for Role Details: the largest US cities, tech hubs,
// every state, and the country itself. Anything else can still be typed in.

const STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
};

// Roughly by population, then tech and business hubs
const CITIES = `
New York|NY; Los Angeles|CA; Chicago|IL; Houston|TX; Phoenix|AZ; Philadelphia|PA;
San Antonio|TX; San Diego|CA; Dallas|TX; Jacksonville|FL; Fort Worth|TX; San Jose|CA;
Austin|TX; Charlotte|NC; Columbus|OH; Indianapolis|IN; San Francisco|CA; Seattle|WA;
Denver|CO; Oklahoma City|OK; Nashville|TN; Washington|DC; El Paso|TX; Las Vegas|NV;
Boston|MA; Detroit|MI; Portland|OR; Louisville|KY; Memphis|TN; Baltimore|MD;
Milwaukee|WI; Albuquerque|NM; Tucson|AZ; Fresno|CA; Sacramento|CA; Mesa|AZ;
Atlanta|GA; Kansas City|MO; Colorado Springs|CO; Omaha|NE; Raleigh|NC; Miami|FL;
Virginia Beach|VA; Long Beach|CA; Oakland|CA; Minneapolis|MN; Bakersfield|CA;
Tulsa|OK; Tampa|FL; Arlington|TX; Wichita|KS; Aurora|CO; New Orleans|LA;
Cleveland|OH; Honolulu|HI; Anaheim|CA; Henderson|NV; Orlando|FL; Lexington|KY;
Stockton|CA; Riverside|CA; Irvine|CA; Corpus Christi|TX; Newark|NJ; Santa Ana|CA;
Cincinnati|OH; Pittsburgh|PA; Saint Paul|MN; Greensboro|NC; Jersey City|NJ;
Durham|NC; Lincoln|NE; Plano|TX; Anchorage|AK; Gilbert|AZ; Madison|WI; Reno|NV;
Chandler|AZ; St. Louis|MO; Buffalo|NY; Fort Wayne|IN; Lubbock|TX; St. Petersburg|FL;
Toledo|OH; Laredo|TX; Irving|TX; Chesapeake|VA; Glendale|AZ; Winston-Salem|NC;
Scottsdale|AZ; Garland|TX; Boise|ID; Norfolk|VA; Spokane|WA; Richmond|VA;
Fremont|CA; Huntsville|AL; Frisco|TX; Salt Lake City|UT; Des Moines|IA;
Birmingham|AL; Rochester|NY; Tacoma|WA; Baton Rouge|LA; Little Rock|AR;
Charleston|SC; Columbia|SC; Hartford|CT; Providence|RI; Manchester|NH;
Burlington|VT; Portland|ME; Wilmington|DE; Charleston|WV; Billings|MT; Fargo|ND;
Sioux Falls|SD; Cheyenne|WY; Jackson|MS;
Sunnyvale|CA; Mountain View|CA; Palo Alto|CA; Santa Clara|CA; Cupertino|CA;
Menlo Park|CA; Redwood City|CA; San Mateo|CA; Pleasanton|CA; Redmond|WA;
Bellevue|WA; Kirkland|WA; Cambridge|MA; Ann Arbor|MI; Boulder|CO; Arlington|VA;
McLean|VA; Reston|VA; Herndon|VA; Bethesda|MD; Columbia|MD; Princeton|NJ;
Hoboken|NJ; Stamford|CT; Cary|NC; Alpharetta|GA; Richardson|TX; McKinney|TX;
The Woodlands|TX; Sugar Land|TX; Round Rock|TX; Tempe|AZ; Lehi|UT; Provo|UT;
Hillsboro|OR
`;

const cityNames = CITIES.split(";")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [city, state] = entry.split("|");
    return `${city}, ${STATES[state]}, United States`;
  });

const stateNames = Object.entries(STATES)
  .filter(([code]) => code !== "DC")
  .map(([, name]) => `${name}, United States`);

export const US_LOCATIONS = [
  "United States",
  "Remote, United States",
  ...cityNames,
  ...stateNames
];

// One-click picks shown under the box
export const POPULAR_LOCATIONS = [
  "Remote, United States",
  "New York, New York, United States",
  "San Francisco, California, United States",
  "Seattle, Washington, United States",
  "Austin, Texas, United States",
  "Dallas, Texas, United States",
  "Chicago, Illinois, United States",
  "Boston, Massachusetts, United States"
];
