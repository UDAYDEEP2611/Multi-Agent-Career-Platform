"""Writes the training examples for the chat's models.

    python3 ml/build_dataset.py     -> ml/data/train.json

Every example comes from a template filled with real words, then a share are
retyped the way people type: ALL CAPS, no punctuation, and typos. Each one keeps
its template's id (group), so cross-validation never tests a model on the same
sentence shape it was trained on.

No set of examples can hold every sentence a person may write. ml/data/holdout.json
is written by hand, is never trained on, and is what the reported accuracy means.
"""
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(7)

ROLES = ["software engineer", "data scientist", "AI engineer", "ML engineer", "backend developer", "product manager", "analyst", "intern", "research assistant", "teaching assistant", "cloud architect", "full stack developer"]
COMPANIES = ["Google", "Oracle", "Verizon", "PayPal", "Amazon", "Infosys", "Tesla", "a startup", "IBM", "Deloitte", "my university", "Acme Corp"]
SCHOOLS = ["UNT", "Stanford", "MIT", "UMKC", "SASTRA University", "JNTU", "Georgia Tech", "the University of Texas"]
DEGREES = ["a masters in computer science", "a bachelors in electronics", "an MBA", "a PhD in machine learning", "a BTech", "an MS in data science"]
PROJECTS = ["TaskVerse", "a chatbot", "JobPilot", "a fraud detection model", "a RAG pipeline", "a portfolio site", "Blood Bank System", "a chrome extension", "UltraUnityVerse", "an inventory app"]
SKILLS = ["Python", "Docker", "LangGraph", "SQL", "Kubernetes", "PyTorch", "React", "AWS", "leadership", "FastAPI"]
CERTS = ["AWS Solutions Architect", "the Google Cloud cert", "PMP", "Azure AI Engineer", "a Coursera certificate", "IBM Data Engineering"]
YEARS = ["2019", "2021", "2023", "2024", "last year", "in March", "last summer"]
COLOURS = ["navy", "blue", "green", "red", "teal", "purple", "maroon", "orange", "pink", "black", "dark green", "#1e3a8a"]
FONTS = ["Inter", "Playfair", "Georgia", "a serif font", "Roboto", "Lora"]
DESIGNS = ["Slate", "Noir", "Mono", "Swiss", "Terminal", "Forest", "Bento"]
SECTIONS = ["projects", "experience", "education", "skills", "certifications", "volunteering", "interests", "achievements", "recommendations"]
LISTS = ["projects", "jobs", "certifications", "schools", "experience", "education"]
EXTRAS = ["interests", "achievements", "volunteering", "publications", "patents"]
ENTRIES = ["Blood Bank", "the Blood Bank project", "UltraUnityVerse", "my Verizon job", "the AWS certification", "Docker", "the housing analytics project", "my internship", "the Oracle role", "JNTU", "that chatbot project", "the Paypal job"]
USES = ["LangGraph", "React", "RAG", "Docker", "AWS"]
COUNTS = ["1", "2", "3", "one", "two", "three", "just one", "only 2", "4"]
RESUME = ["resume", "cv", "this resume", "my resume", "this one"]
QA_THINGS = ["GPA", "latest job", "strongest skill", "headline", "current role", "degree", "phone number", "summary"]

SLOTS = {"role": ROLES, "company": COMPANIES, "school": SCHOOLS, "degree": DEGREES, "project": PROJECTS, "skill": SKILLS, "cert": CERTS, "year": YEARS, "colour": COLOURS, "font": FONTS, "design": DESIGNS, "section": SECTIONS, "list": LISTS, "extra": EXTRAS, "entry": ENTRIES, "use": USES, "count": COUNTS, "resume": RESUME, "thing": QA_THINGS}

INTENT = {
    "entry": [
        "I worked at {company} as a {role} from {year}", "I work at {company}", "I joined {company} {year}", "I got a new job as {role} at {company}", "started as a {role} at {company} {year}",
        "add my job at {company}", "add this to my experience", "put this under experience", "i was promoted to {role}", "I interned at {company} {year}",
        "I studied at {school}", "I graduated from {school} {year}", "I finished {degree} at {school}", "add my degree", "I did {degree}", "add {degree} to my education", "I'm doing {degree} now",
        "I built {project}", "I made {project} {year}", "add a project", "I want to add a project", "add a new project called {project}", "Project name: {project}", "save {project} as a project", "here are my project details", "this project name and details and tasks",
        "add {skill} to my skills", "I know {skill}", "add {skill} as a skill", "add {skill}, {skill} and {skill} to my skills", "I learned {skill} {year}",
        "I earned {cert}", "add my certification {cert}", "I got certified in {cert}", "put {cert} in my certifications", "new certificate {cert}",
        "I won an award at {company}", "add an achievement", "I volunteer at a food bank", "add volunteering at the red cross", "I published a paper on {skill}", "add my paper", "I was granted a patent", "add a patent",
        "my hobbies are chess and hiking", "add {skill} to my interests", "update my summary to say I build agents", "change my phone number", "my new headline is {role}", "update my linkedin", "my email changed", "my manager wrote me a recommendation", "add a recommendation from my manager",
        "Company: {company}", "Degree: MS", "Title: {role}", "please record this for me", "I'm looking for {role} roles"
    ],
    "design": [
        "make my portfolio {colour}", "change the colour to {colour}", "use {colour} as the accent", "make it {colour}", "I want a {colour} portfolio", "the accent should be {colour}", "give {design} a {colour} accent",
        "change the font to {font}", "use {font} for headings", "use {font} for body text", "headings should use {font}", "make the corners rounded", "sharp corners please", "use dark mode", "always light mode", "make it look modern", "make it more playful", "it should look like a newspaper",
        "create a new design from {design}", "make a {design} design called Forest", "delete my {design} design", "copy the {design} design", "rename the design", "list my custom designs",
        "hide {section} on my portfolio", "hide the {section} section", "show {section} first", "put {section} before experience", "remove {section} from the portfolio", "rename {section} to my work", "show only 2 {section} on this portfolio",
        "show all my {list} on my {resume}", "only {count} {list} on my {resume}", "put {count} {list} on my resume", "add {extra} to my {resume}", "remove {extra} from my {resume}", "include all skills on my {resume}", "only key skills on my {resume}", "reset my resume to default", "all {list} on my resumes", "keep {count} {list} in my cv",
        "hide {entry} from my {resume}", "remove {entry} from my resumes", "take {entry} off my {resume}", "keep {entry} off my {resume}", "put {entry} back on my {resume}", "in resumes only 15 important skills", "all exps included on my resume", "keep certifications at left on my resume", "move education to the right column on my resume", "remove the grade from my resume", "hide the organization name in my resume certifications", "show my resume skills in boxes", "put skills side by side on my resume"
    ],
    "qa": [
        "what is my {thing}", "what's my {thing}", "where did I study", "where do I work", "where did I work before {company}", "when did I join {company}", "when did I start at {company}", "how long was I at {company}", "how many projects do I have", "how many years of experience do I have",
        "which skills do I have", "what skills do I have", "do I know {skill}", "did I use {skill} anywhere", "have I used {skill}", "which projects used {skill}", "list my projects", "list my certifications", "list everything I built with {skill}", "show me my {thing}", "tell me about my {thing}", "tell me about {project}",
        "what did I do at {company}", "what did I study at {school}", "who recommended me", "which certifications do I have", "am I missing anything for a {role} role", "give me my summary", "find the project with {skill}", "summarize my experience", "what are my most recent jobs", "is {skill} in my skills", "do I have {cert}", "what is on my resume about {skill}"
    ],
    "help": [
        "hello", "hi", "hey", "hi there", "good morning", "good evening", "good afternoon", "thanks", "thank you", "thanks a lot", "cool thanks", "ok thanks", "bye", "goodbye", "see you", "help", "help me", "can you help me", "what can you do", "what can this assistant do", "how do I use you", "who are you", "what is this chat", "what are you able to help with", "how does this work"
    ]
}

SECTION = {
    "profile": ["my name is Jane", "update my profile", "my github url is here", "my phone number is 555 0100", "change my email", "my linkedin is here", "my headline is {role}", "I live in Dallas", "update my address", "I am looking for {role} roles", "Name: Jane Doe", "Phone: 555 0100"],
    "summary": ["update my summary", "my about me says I build agents", "write in my bio that I am a {role}", "change my summary", "Summary: {role} with 4 years", "my professional summary is this", "about me section"],
    "experience": ["I worked at {company} as a {role}", "new job at {company}", "add my job", "add experience", "I joined {company}", "internship at {company}", "add this to my experience", "I am a {role} at {company}", "Company: {company}", "Job title: {role}", "employer {company}", "my role at {company}", "add a position", "promoted to {role}"],
    "education": ["I studied at {school}", "I did {degree}", "add my degree", "add education", "graduated from {school}", "School: {school}", "Degree: MS", "GPA 3.9", "my university is {school}", "add a college", "I finished {degree}"],
    "skills": ["add {skill} to my skills", "I know {skill}", "add a skill", "add skills {skill} and {skill}", "new skill {skill}", "Skills: {skill}, {skill}", "rate {skill} 5 out of 5", "mark {skill} important"],
    "certifications": ["I earned {cert}", "add a certification", "add certificate {cert}", "I got certified in {cert}", "Certification: {cert}", "credential id for {cert}", "add my license", "issued by Coursera"],
    "projects": ["I built {project}", "add a project", "add project {project}", "Project name: {project}", "I made {project}", "my side project {project}", "this project name and details", "github repo for {project}", "new project", "I created {project}"],
    "achievements": ["I won a hackathon", "add an award", "add an achievement", "best paper award", "I received a scholarship", "first place in a competition", "Award: dean's list"],
    "volunteering": ["I volunteer at a food bank", "add volunteering", "I taught kids coding as a volunteer", "volunteer work at the red cross", "volunteer role"],
    "recommendations": ["my manager wrote me a recommendation", "add a recommendation", "testimonial from my manager", "add a reference from my professor", "Jane recommended me"],
    "publications": ["I published a paper", "add a publication", "my paper at NeurIPS", "journal article on {skill}", "my paper got accepted"],
    "patents": ["I was granted a patent", "add a patent", "patent number US123", "I filed a patent"],
    "interests": ["my hobbies are chess and hiking", "add an interest", "I love photography", "I enjoy cooking", "interests: travel"]
}

ACTION = {
    "hide_entry": ["hide {entry}", "remove {entry}", "take {entry} off", "take off {entry}", "drop {entry}", "delete {entry} from this", "get rid of {entry}", "lose {entry}", "ditch {entry}", "cut {entry}", "leave {entry} out", "leave out {entry}", "no {entry} please", "i dont want {entry}", "don't show {entry}", "don't include {entry}", "exclude {entry}", "omit {entry}", "skip {entry}", "take away {entry}", "{entry} should not be here", "without {entry}", "hide the project that uses {use}", "remove projects using {use}", "remove all the certificates", "hide my {list}", "no {list} on here", "i don't want {list} on this one"],
    "show_entry": ["show {entry}", "bring back {entry}", "bring {entry} back", "put {entry} back", "put back {entry}", "restore {entry}", "unhide {entry}", "add back {entry}", "add {entry} back", "i want {entry} back", "{entry} should be here", "include {entry} again", "return {entry}", "show {entry} again"],
    "limit": ["only {count} {list}", "just {count} {list}", "show {count} {list}", "{count} {list} only", "keep {count} {list}", "limit {list} to {count}", "show all my {list}", "all {list}", "every {list}", "all {list} included", "more {list}", "fewer {list}", "show the rest of my {list}", "keep just my latest {list}", "only the top {count} {list}", "show all skills", "only key skills", "every skill", "only 15 skills", "just my most recent position", "keep my latest job only"],
    "section": ["add {extra}", "include {extra}", "show {extra}", "put {extra} on", "add a {extra} section", "remove {extra}", "hide {extra}", "no {extra}", "without {extra} section", "drop the {extra} section", "add {extra} details", "{extra} add", "{extra} remove", "{extra} not needed", "{extra} should be there", "{extra} should not be there", "i want {extra}", "i dont want {extra}", "turn on {extra}", "turn off {extra}", "{extra} is missing", "enable {extra}", "disable {extra}"],
    "colour": ["make it {colour}", "change the colour to {colour}", "{colour} please", "use {colour}", "recolour it {colour}", "colour {colour}", "i want it {colour}", "change accent to {colour}", "a {colour} one", "color should be {colour}", "use the colour {colour}"],
    "reset": ["reset this resume", "reset", "start over", "undo all", "undo everything", "back to default", "back to the default", "reset to default", "clear my changes", "go back to how it was", "restore the default"],
    "status": ["what's on this resume", "what is on this resume", "what does this resume show", "what's on my resume", "show my settings", "what are the settings", "what have I changed", "how many projects does this show", "which entries are hidden", "what is left off", "what did i remove", "what did i take off", "what have i hidden so far", "show me what is hidden", "what did i leave out", "what's missing from this one", "list what i removed"],
    "hide_detail": ["remove the grade in education", "remove grade from {degree}", "remove only the grade in {degree}", "hide my gpa", "no gpa on {degree}", "take the gpa off", "leave out the marks for {degree}", "remove the percentage in education", "in education remove the grade", "in certifications remove the organization name", "remove the organization name from my certifications", "remove the issuer from {cert}", "take the issuer off {cert}", "just the certificate title without the organization", "remove the provider keep the rest", "drop the location from {entry}", "remove location in experience", "hide the city on {entry}", "no dates on my {list}", "remove dates from {entry}", "hide the years on {entry}", "drop the description of {entry}", "remove the bullets from {entry}", "remove only the dates and keep everything else", "keep {entry} but remove the grade", "keep {entry} but take the location off", "the grade can go but keep the degree", "remove the role in {entry}", "take the link off {entry}", "{list} dates remove", "{list} date not needed", "gpa remove", "no gpa", "grade not needed", "phone number remove", "no email", "no linkedin", "patent number not needed", "volunteer dates remove", "publisher remove", "{entry} dates not needed", "{list} without dates", "company name hide"],
    "show_detail": ["show the grade in education", "put the grade back", "bring back my gpa", "put back the location on {entry}", "show the dates on {entry}", "restore the description of {entry}", "add the issuer back to {cert}", "i want my grade back", "put the organization name back on my certifications", "show the years again"],
    "move_column": ["move {list} to the left column", "move {list} to the right column", "shift {list} to the sidebar", "put {list} in the main column", "{list} should be on the left", "{list} goes on the right", "move it to the other column", "swap the columns", "put {list} on the narrow side", "i want {list} in the wide column", "send {list} over to the right", "keep {list} at left"],
    "skill_style": ["put my skills in boxes", "skills side by side", "show skills in a box with padding", "make skills look like tags", "skills as chips", "draw skills as pills", "skills in a list", "show skills one per line", "skills as bars", "skills with rating dots", "skills on one line", "skills separated by commas", "change the skills layout", "put everything in skills side by side", "make the skills look better", "skills with padding inside a box"],
    "edit_text": ["change the title of {entry} to something else", "rename {entry} to {project}", "change it to {cert}", "reword my summary", "rewrite the description of {entry}", "edit the title of {cert}", "replace {entry} with {project}", "update {entry} to say {role}", "fix the spelling in {entry}", "give {entry} a new name", "call {entry} something else", "name my job differently", "change {company} to {company}", "the certificate should read {cert}"],
    "other": ["hello", "thanks", "what can you do", "help", "this looks nice", "why is it so long", "who are you", "what is my gpa", "where did I work", "ok", "great", "cool", "write me a cover letter", "tell me a joke", "i worked at {company}", "add a new job at {company}", "make it pop", "make it better", "this is ugly", "i hate this", "something feels off", "not good", "make it look professional", "can it look more modern", "make it one page", "make it shorter", "reduce the spacing", "make the font bigger", "use a serif font", "make my name bigger", "add a photo", "translate this to spanish", "download this as pdf", "email this to my boss", "what should i improve", "will this pass ats", "is this resume good", "why did you do that", "never mind", "yes", "no", "do it", "what is the weather", "lol", "sounds good", "go for it", "alright", "sure", "how is the traffic today", "what time is it", "who won the game", "what's the news", "write a better summary", "tailor this to a {role} job"]
}

TASKS = {"intent": INTENT, "section": SECTION, "action": ACTION}
KEYS = {"q": "wa", "w": "qe", "e": "wr", "r": "et", "t": "ry", "y": "tu", "u": "yi", "i": "uo", "o": "ip", "p": "ol", "a": "qs", "s": "ad", "d": "sf", "f": "dg", "g": "fh", "h": "gj", "j": "hk", "k": "jl", "l": "kp", "z": "xa", "x": "zc", "c": "xv", "v": "cb", "b": "vn", "n": "bm", "m": "nk"}


def fill(template):
    return "".join(rng.choice(SLOTS[part[1:-1]]) if part.startswith("{") else part for part in split(template))


def split(template):
    out, rest = [], template
    while "{" in rest:
        head, tail = rest.split("{", 1)
        slot, rest = tail.split("}", 1)
        out += [head, "{" + slot + "}"]
    return out + [rest]


def typo(word):
    if len(word) < 4 or not word.isalpha():
        return word
    i = rng.randrange(1, len(word) - 1)
    kind = rng.random()
    if kind < 0.35:
        return word[:i] + word[i + 1:]  # a missed letter
    if kind < 0.65:
        return word[:i] + word[i + 1] + word[i] + word[i + 2:]  # two swapped
    if kind < 0.85:
        return word[:i] + word[i] + word[i:]  # a doubled letter
    near = KEYS.get(word[i].lower())
    return word[:i] + (rng.choice(near) if near else word[i]) + word[i + 1:]  # next key


def retype(text):
    """The same sentence as people really type it."""
    kind = rng.random()
    if kind < 0.45:
        return text
    words = text.split(" ")
    if kind < 0.8:
        words = [typo(word) if rng.random() < 0.35 else word for word in words]
    out = " ".join(words)
    roll = rng.random()
    if roll < 0.3:
        return out.upper()
    if roll < 0.6:
        return out.lower()
    return out


def has_slots(template):
    return "{" in template


data = {}
for task, labels in TASKS.items():
    rows = []
    for label, templates in labels.items():
        for number, template in enumerate(templates):
            group = f"{label}:{number}"
            for _ in range(14 if has_slots(template) else 7):
                rows.append({"text": retype(fill(template)), "label": label, "group": group})
            rows.append({"text": fill(template), "label": label, "group": group})
    seen = set()
    unique = []
    for row in rows:
        key = (row["text"], row["label"])
        if key not in seen:
            seen.add(key)
            unique.append(row)
    data[task] = unique
    print(task, len(unique), "examples from", sum(len(t) for t in labels.values()), "templates")

os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
with open(os.path.join(HERE, "data", "train.json"), "w") as out:
    json.dump(data, out)
