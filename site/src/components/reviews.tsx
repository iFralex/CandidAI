import { Star } from "lucide-react";
import { Card } from "./ui/card";

export const reviews = [
    {
        name: "Sarah Mitchell",
        role: "Software Engineer",
        company: "Google",
        rating: 5,
        text: "CandidAI helped me land my dream job at Google! The personalized emails were so well-crafted that I got responses from 8 out of 10 companies I targeted.",
        avatar: "SM"
    },
    {
        name: "Marcus Johnson",
        role: "Product Manager",
        company: "Microsoft",
        rating: 5,
        text: "The time savings are incredible. What used to take me 4+ hours per company now takes 2 minutes. The AI really understands how to speak to recruiters.",
        avatar: "MJ"
    },
    {
        name: "Elena Rodriguez",
        role: "Data Scientist",
        company: "Netflix",
        rating: 5,
        text: "I was skeptical about AI-generated emails, but the results speak for themselves. 90% response rate and 3 job offers within a month!",
        avatar: "ER"
    },
    {
        name: "James Chen",
        role: "UX Designer",
        company: "Airbnb",
        rating: 5,
        text: "The company research depth is amazing. Each email felt like it was written by someone who truly understood both me and the target company.",
        avatar: "JC"
    },
    {
        name: "Lisa Thompson",
        role: "Marketing Director",
        company: "Spotify",
        rating: 5,
        text: "Finally got responses from top-tier companies that were ignoring my applications. The follow-up automation is a game-changer too!",
        avatar: "LT"
    },
    {
        name: "David Park",
        role: "DevOps Engineer",
        company: "Uber",
        rating: 5,
        text: "The Ultra plan's AI company recommendations introduced me to companies I never would have considered. Landed my dream role thanks to that feature!",
        avatar: "DP"
    }
];

export const Review = ({ review }) => {
    return (
        <Card className="p-6">
            <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold mr-4">
                    {review.avatar}
                </div>
                <div>
                    <h3 className="text-white font-semibold">{review.name}</h3>
                    <p className="text-gray-200 text-sm">{review.role} at {review.company}</p>
                </div>
            </div>

            <div className="flex mb-4">
                {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                ))}
            </div>
            <p className="text-gray-300 leading-relaxed line-clamp-9">“{review.text}”</p>
        </Card>
    )
}