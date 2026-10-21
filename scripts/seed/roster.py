"""Roster of the RNSIT batch used by the GTA demo seed.

Every entry is a fictional but realistic RNSIT Bengaluru student or faculty
member: Indian names, a department from the real department list, an academic
year, a USN in the 1RN23CS001 format the college uses, and a short bio.

The four original project authors are kept and given the top-contributor
positions so the demo leaderboard looks the way the team expects.
"""

from __future__ import annotations

# (name, department, academic_year, usn_prefix, usn_number)
_STUDENTS_RAW = [
    # --- Computer Science & Engineering (16) ---
    ("Tarun S", "Computer Science", "4th Year", "1RN21CS", "045"),
    ("Varun B R", "Computer Science", "4th Year", "1RN21CS", "052"),
    ("Vedanth P", "Computer Science", "4th Year", "1RN21CS", "061"),
    ("Vivek S D", "Computer Science", "4th Year", "1RN21CS", "033"),
    ("Aditya Sharma", "Computer Science", "3rd Year", "1RN22CS", "074"),
    ("Priya Nair", "Computer Science", "3rd Year", "1RN22CS", "086"),
    ("Karthik Reddy", "Computer Science", "2nd Year", "1RN23CS", "012"),
    ("Sneha Iyer", "Computer Science", "3rd Year", "1RN22CS", "093"),
    ("Rahul Verma", "Computer Science", "2nd Year", "1RN23CS", "027"),
    ("Meghana Kulkarni", "Computer Science", "4th Year", "1RN21CS", "107"),
    ("Arjun Deshpande", "Computer Science", "3rd Year", "1RN22CS", "115"),
    ("Nisha Jain", "Computer Science", "2nd Year", "1RN23CS", "038"),
    ("Vinay Kumar", "Computer Science", "4th Year", "1RN21CS", "124"),
    ("Rohan Choudhary", "Computer Science", "1st Year", "1RN24CS", "009"),
    ("Aishwarya Bhat", "Computer Science", "2nd Year", "1RN23CS", "046"),
    ("Deepa Shridhar", "Computer Science", "1st Year", "1RN24CS", "021"),
    # --- Information Science & Engineering (11) ---
    ("Manjunath Gowda", "Information Science", "4th Year", "1RN21IS", "014"),
    ("Divya Menon", "Information Science", "3rd Year", "1RN22IS", "028"),
    ("Sandeep Patil", "Information Science", "2nd Year", "1RN23IS", "035"),
    ("Nikhil Raj", "Information Science", "4th Year", "1RN21IS", "047"),
    ("Pooja Hegde", "Information Science", "3rd Year", "1RN22IS", "053"),
    ("Sridhar Naik", "Information Science", "1st Year", "1RN24IS", "006"),
    ("Kavya Murthy", "Information Science", "2nd Year", "1RN23IS", "061"),
    ("Harsh Pandey", "Information Science", "4th Year", "1RN21IS", "072"),
    ("Sameer Khan", "Information Science", "3rd Year", "1RN22IS", "081"),
    ("Bhavana Rao", "Information Science", "2nd Year", "1RN23IS", "090"),
    ("Akash George", "Information Science", "1st Year", "1RN24IS", "017"),
    # --- Electronics & Communication (10) ---
    ("Rithika Pillai", "Electronics", "4th Year", "1RN21EC", "011"),
    ("Yash Agarwal", "Electronics", "3rd Year", "1RN22EC", "023"),
    ("Tanvi Joshi", "Electronics", "2nd Year", "1RN23EC", "039"),
    ("Abhishek Ghosh", "Electronics", "4th Year", "1RN21EC", "044"),
    ("Shruthi Kamath", "Electronics", "3rd Year", "1RN22EC", "058"),
    ("Vishal Yadav", "Electronics", "1st Year", "1RN24EC", "012"),
    ("Anjali Suresh", "Electronics", "2nd Year", "1RN23EC", "067"),
    ("Rohit Kulkarni", "Electronics", "4th Year", "1RN21EC", "073"),
    ("Sanjay Gowda", "Electronics", "3rd Year", "1RN22EC", "089"),
    ("Nandini Prakash", "Electronics", "1st Year", "1RN24EC", "025"),
    # --- Mechanical (8) ---
    ("Imran Shaikh", "Mechanical", "4th Year", "1RN21ME", "019"),
    ("Gayathri Ram", "Mechanical", "3rd Year", "1RN22ME", "032"),
    ("Puneet Sinha", "Mechanical", "2nd Year", "1RN23ME", "048"),
    ("Ishita Bose", "Mechanical", "4th Year", "1RN21ME", "055"),
    ("Suresh Babu", "Mechanical", "3rd Year", "1RN22ME", "071"),
    ("Amrita Kaur", "Mechanical", "1st Year", "1RN24ME", "004"),
    ("Shreyas Bondu", "Mechanical", "2nd Year", "1RN23ME", "076"),
    ("Ritika Anand", "Mechanical", "3rd Year", "1RN22ME", "092"),
    # --- Civil (7) ---
    ("Harish Bhat", "Civil", "4th Year", "1RN21CE", "008"),
    ("Swathi Varma", "Civil", "3rd Year", "1RN22CE", "026"),
    ("Zoya Khan", "Civil", "2nd Year", "1RN23CE", "041"),
    ("Chandana M", "Civil", "1st Year", "1RN24CE", "015"),
    ("Prabhu Sharan", "Civil", "4th Year", "1RN21CE", "063"),
    ("Ashwini Hiremath", "Civil", "3rd Year", "1RN22CE", "078"),
    ("Tejaswi Rao", "Civil", "2nd Year", "1RN23CE", "095"),
    # --- Electrical & Electronics (8) ---
    ("Omkar Deshpande", "Electrical", "4th Year", "1RN21EE", "016"),
    ("Vaishnavi Iyer", "Electrical", "3rd Year", "1RN22EE", "030"),
    ("Aravind Kumar", "Electrical", "2nd Year", "1RN23EE", "044"),
    ("Ishita Menon", "Electrical", "4th Year", "1RN21EE", "059"),
    ("Sujith Menon", "Electrical", "3rd Year", "1RN22EE", "066"),
    ("Anvitha Kamath", "Electrical", "1st Year", "1RN24EE", "022"),
    ("Ganesh Bhat", "Electrical", "2nd Year", "1RN23EE", "083"),
    ("Riya Fernandes", "Electrical", "4th Year", "1RN21EE", "098"),
    # --- MBA (5) ---
    ("Yashwant Patil", "MBA", "Graduate", "1RN22MB", "007"),
    ("Manasa Singh", "MBA", "Post Graduate", "1RN21MB", "013"),
    ("Karthik Menon", "MBA", "Graduate", "1RN22MB", "029"),
    ("Aishwarya Iyer", "MBA", "Post Graduate", "1RN21MB", "042"),
    ("Nikhil Dsouza", "MBA", "Graduate", "1RN22MB", "057"),
    # --- MCA (5) ---
    ("Praveen Naik", "MCA", "Post Graduate", "1RN21MC", "005"),
    ("Sneha Kamath", "MCA", "Post Graduate", "1RN21MC", "020"),
    ("Anirudh Rao", "MCA", "Graduate", "1RN22MC", "036"),
    ("Shruti Hegde", "MCA", "Post Graduate", "1RN21MC", "051"),
    ("Varalakshmi S", "MCA", "Graduate", "1RN22MC", "068"),
]

# name, department, designation, experience, expertise, cabin
_TEACHERS_RAW = [
    (
        "Dr. Anil Kumar Sharma",
        "Computer Science",
        "Professor & Head of Department",
        "18 years",
        "Data Structures & Algorithms, Distributed Systems, Machine Learning, Operating Systems",
        "Block A, Room 312",
    ),
    (
        "Prof. Meenakshi Iyer",
        "Information Science",
        "Associate Professor",
        "13 years",
        "Database Systems, Information Retrieval, Data Warehousing, SQL Optimization",
        "Block C, Room 204",
    ),
    (
        "Dr. Rajesh Kulkarni",
        "Electronics",
        "Professor",
        "16 years",
        "VLSI Design, Embedded Systems, Signal Processing, Digital Electronics",
        "Block B, Room 405",
    ),
    (
        "Prof. Sunitha Rao",
        "Mechanical",
        "Associate Professor",
        "11 years",
        "Thermodynamics, Fluid Mechanics, CAD/CAM, Automobile Engineering",
        "Block D, Room 118",
    ),
    (
        "Dr. Prakash Nair",
        "Civil",
        "Assistant Professor",
        "8 years",
        "Structural Engineering, Construction Management, Geotechnical Engineering",
        "Block F, Room 207",
    ),
    (
        "Prof. Deepa Shetty",
        "Electrical",
        "Assistant Professor",
        "9 years",
        "Power Systems, Renewable Energy, Control Systems, Electrical Machines",
        "Block E, Room 110",
    ),
    (
        "Dr. Karthik Murthy",
        "MBA",
        "Professor & Director",
        "20 years",
        "Business Strategy, Marketing Management, Organisational Behaviour, Entrepreneurship",
        "Admin Block, Room 401",
    ),
    (
        "Prof. Vinaya Deshpande",
        "MCA",
        "Assistant Professor",
        "7 years",
        "Software Engineering, Web Technologies, Cloud Computing, Software Testing",
        "PG Block, Room 215",
    ),
    (
        "Dr. Harish Gowda",
        "Computer Science",
        "Associate Professor",
        "14 years",
        "Computer Networks, Cyber Security, Cloud Architecture, Compiler Design",
        "Block A, Room 309",
    ),
]

_TEACHER_DEPT_LABEL = {
    "Computer Science": "Computer Science & Engineering",
    "Information Science": "Information Science & Engineering",
    "Electronics": "Electronics & Communication",
    "Mechanical": "Mechanical Engineering",
    "Civil": "Civil Engineering",
    "Electrical": "Electrical & Electronics",
    "MBA": "Master of Business Administration",
    "MCA": "Master of Computer Applications",
}

# Short, believable bios used per department/year flavour.
_STUDENT_BIO_TEMPLATES = [
    "{year} {dept} student at RNSIT. {focus}. Always up for a weekend hackathon.",
    "{dept} {year} at RNSIT. {focus}. Part of the campus {club} and love teaching juniors.",
    "{year} {dept} student. {focus}. Building side projects and looking for teammates.",
    "{dept} {year}, RNSIT Bengaluru. {focus}. Coffee-powered problem solver.",
    "{year} {dept}. {focus}. {club} member — ask me about the last hackathon.",
    "{dept} {year} student. {focus}. I make {artifact} in my free time.",
]

_FOCUS_BY_DEPT = {
    "Computer Science": [
        "Into web development and competitive programming",
        "Building things with React and Supabase",
        "Obsessed with clean architecture and system design",
        "LeetCode grinder, mostly Graphs and DP",
        "Backend guy who loves databases and caching",
        "Into machine learning and computer vision side projects",
    ],
    "Information Science": [
        "Passionate about data analytics and dashboards",
        "Learning ML and shipping small models",
        "Into SQL tuning and data pipelines",
        "Building a campus analytics dashboard",
        "Data viz nerd, Power BI and Python",
    ],
    "Electronics": [
        "Embedded C and Arduino tinkering",
        "Into PCB design and Verilog",
        "Working on an IoT weather station",
        "Circuit design and signal analysis",
        "Robotics and embedded systems",
    ],
    "Mechanical": [
        "CAD modelling and FEA simulations",
        "Into Formula SAE and design teams",
        "3D printing and fabrication",
        "Thermodynamics and CFD enthusiast",
    ],
    "Civil": [
        "Into structural design and BIM",
        "Working on a sustainable campus project",
        "Surveying, site planning and estimation",
        "AutoCAD and STAAD.Pro",
    ],
    "Electrical": [
        "Power electronics and solar projects",
        "Into control systems and simulations",
        "Building a smart energy meter",
        "Matlab and Simulium projects",
    ],
    "MBA": [
        "Consulting and case study prep",
        "Marketing analytics and brand strategy",
        "Startup pitch and venture capital",
        "Operations and supply chain",
    ],
    "MCA": [
        "Full-stack development with React and Node",
        "Into cloud-native deployments",
        "Building tools for campus administration",
        "Software testing and DevOps",
    ],
}

_ARTIFACTS = [
    "short films", "poster art", "web apps", "podcasts", "3D models",
    "short videos", "board games", "Arduino rigs",
]

_CLUBS = [
    "Coding Club", "Robotics Club", "IEEE Student Branch", "Design Collective",
    "Astronomy Club", "Debate Club", "Photography Club", "Eco Club",
]


def _pick(seq, index):
    return seq[index % len(seq)]


def build_students():
    """Return the 70 student records as dicts."""
    students = []
    for idx, (name, dept, year, usn_prefix, usn_no) in enumerate(_STUDENTS_RAW):
        focus = _pick(_FOCUS_BY_DEPT[dept], idx)
        bio = _pick(_STUDENT_BIO_TEMPLATES, idx).format(
            year=year,
            dept=_TEACHER_DEPT_LABEL[dept],
            focus=focus,
            club=_pick(_CLUBS, idx),
            artifact=_pick(_ARTIFACTS, idx),
        )
        students.append(
            {
                "full_name": name,
                "department": dept,
                "academic_year": year,
                "usn": f"{usn_prefix}{usn_no}",
                "bio": bio,
            }
        )
    return students


def build_teachers():
    """Return the 9 faculty records as dicts."""
    teachers = []
    for name, dept, designation, experience, expertise, cabin in _TEACHERS_RAW:
        teachers.append(
            {
                "full_name": name,
                "department": dept,
                "academic_year": "Faculty",
                "usn": "",
                "bio": f"{designation} in the {dept} department at RNSIT. {expertise}.",
                "designation": designation,
                "experience": experience,
                "expertise": expertise,
                "cabin_location": cabin,
            }
        )
    return teachers


if __name__ == "__main__":
    s = build_students()
    t = build_teachers()
    print(f"students: {len(s)}  teachers: {len(t)}")
    assert len(s) == 70, len(s)
    assert len(t) == 9, len(t)
    assert len({x["full_name"] for x in s + t}) == 79
