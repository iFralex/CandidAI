export interface EmailExample {
    company: string;
    candidate: string;
    role: string;
    subject: string;
    preview: string;
    recruiter: string;
    matchScore: string;
}

export const emailExamples: EmailExample[] = [
    {
        company: "Oatly",
        candidate: "Freya Lindholm",
        role: "Marketing · University of Gothenburg",
        subject: "Marketing grad with food brand social growth",
        preview: "Hi Hannah,\n\nI'm a recent marketing graduate from University of Gothenburg, and I've been following Oatly's playful social-first campaigns. During a 6-month internship at a local food brand, I grew their Instagram from 2,000 to 9,000 followers and ran a campaign that boosted online orders by 15%. I'm comfortable with Canva, Meta Ads, and content planning. I'd like to bring that scrappy growth mindset to Oatly's brand team. Could we have a 15-minute chat about junior roles on your social team?",
        recruiter: "Hannah",
        matchScore: "92%"
    },
    {
        company: "HubSpot",
        candidate: "Marcus Johnson",
        role: "Sales · Arizona State University",
        subject: "Aspiring SDR with top sales results",
        preview: "Hi Ashley,\n\nI'm a final-year Business student at ASU with a top sales performance at an electronics retailer, where I closed $45k in a quarter as the top associate. I know you started as an SDR, which is the path I'm pursuing. My campus sales competition 2nd place showed I can learn fast. HubSpot's focus on helping small sales teams thrive resonates with me because I've seen how the right tools empower reps. Could we have a 15-minute chat about the SDR role?",
        recruiter: "Ashley",
        matchScore: "89%"
    },
    {
        company: "N26",
        candidate: "Lucía Morales",
        role: "Finance · Valencia",
        subject: "FP&A Junior Candidate — Lucia Morales",
        preview: "Hi Julia,\n\nI noticed N26's recent push toward disciplined unit economics and path to profitability, which aligns with my background in financial modeling and efficiency. During my internship at a small advisory firm, I built an Excel model that cut monthly management reporting from two days to three hours. My thesis valued a listed company, strengthening my financial analysis skills. I believe my experience could contribute to N26's FP&A team as you drive disciplined financial planning. Could we schedule a 15-minute conversation to explore junior FP&A analyst opportunities?",
        recruiter: "Julia",
        matchScore: "94%"
    },
    {
        company: "Razorpay",
        candidate: "Rohan Mehta",
        role: "Computer Science · VIT Vellore",
        subject: "Rohan Mehta, built app used by 300",
        preview: "Hi Ananya,\n\nI've been following Razorpay's product engineering expansion for merchant payments. I built a study-group scheduling app now used by about 300 classmates at VIT Vellore, working with React and Node. I also did freelance websites, giving me a feel for real-world requirements. I think my experience building a functional tool for real users aligns with the kind of scalable products Razorpay builds. Could we have a 15-minute chat about a junior full-stack role on your team?",
        recruiter: "Ananya",
        matchScore: "91%"
    },
    {
        company: "Nubank",
        candidate: "Camila Santos",
        role: "Statistics · UFMG",
        subject: "Data analyst candidate with Tableau experience",
        preview: "Hi Bruno,\n\nAs a statistics graduate with internship experience in data analytics, I've been following Nubank's data-driven approach to credit and customer growth. In my 4-month internship at a retailer, I built a Tableau dashboard that helped reduce stockouts by about 10%. I'm currently learning Python to expand my analytics toolkit. I believe my experience using data to solve operational problems aligns with the work your analytics team does. Could we have a 15-minute chat to discuss junior analyst roles that fit my background?\n\nBest,\nCamila Santos",
        recruiter: "Bruno",
        matchScore: "93%"
    }
];
