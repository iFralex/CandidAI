import Image from "next/image";
import { CompanyLogo } from "./dashboard";
import { Badge } from "./ui/badge";
import { Edit2, Plus, X } from "lucide-react";
import Link from "next/link";

interface SkillsListBaseProps {
  skills: string[];
  editable?: boolean;
  newSkill?: string;
  setNewSkill?: (val: string) => void;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onStartAdd?: () => void;
  onCancelAdd?: () => void;
}

export default function SkillsListBase({
  skills,
  editable = false,
  newSkill = "",
  setNewSkill,
  onAdd,
  onRemove,
  onStartAdd,
  onCancelAdd
}: SkillsListBaseProps) {
  return (
    <div className="flex flex-wrap gap-2 items-start">
      {skills?.map((skill, index) => (
        <Badge key={index} className="font-bold relative group px-0">
          <div className='flex justify-between items-center pl-2 pr-1 gap-2'>
            {skill}
            {editable && (
              <button
                type="button"
                onClick={() => onRemove?.(index)}
                className="bg-black/20 hover:bg-red-500/50 rounded-full transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </Badge>
      ))}

      {editable && (
        <>
          {onStartAdd && setNewSkill && newSkill !== undefined ? (
            newSkill !== "" || onCancelAdd ? (
              <div className="flex items-center gap-1 border rounded-full px-2 py-1">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAdd?.()}
                  onBlur={() => !newSkill.trim() && onCancelAdd?.()}
                  placeholder="New skill"
                  maxLength={30}
                  className="bg-transparent outline-none text-sm"
                  autoFocus
                />
                {newSkill.trim() ? (
                  <button onClick={onAdd}>
                    <Plus className="w-4 h-4 text-green-500" />
                  </button>
                ) : (
                  <button onClick={onCancelAdd}>
                    <X className="text-red-400 size-4" />
                  </button>
                )}
              </div>
            ) : (
              <Badge
                onClick={onStartAdd}
                className="cursor-pointer flex items-center gap-1 font-bold bg-transparent text-white hover:bg-white/5 transition border border-white/90"
              >
                <Plus className="w-4 h-4" /> Add
              </Badge>
            )
          ) : null}
        </>
      )}
    </div>
  );
}

interface ExperienceListProps {
    experience: any[];
    editable?: boolean;
    onEdit?: (index: number) => void;
}

export function ExperienceList({ experience, editable = false, onEdit }: ExperienceListProps) {
    return (
        <>
            {experience?.length ? (
                experience.map((exp, idx) => (
                    <Link href={exp.company.linkedin_url ? ("https://" + exp.company.linkedin_url) : "#"} target="_blank" rel="noopener noreferrer">
                    <li
                        key={idx}
                        className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors flex justify-between"
                    >
                        <div className="flex items-start gap-3 flex-1">
                            <CompanyLogo link={exp.company?.logo_url} company={exp.company?.domain || exp.company?.name || ""} />

                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium">{exp.title?.name || "Role not available"}</p>
                                {exp.company?.name && (
                                    <p className="text-gray-300 text-sm">
                                        {exp.company.name}
                                        {exp.company.location?.name && ` · ${exp.company.location.name}`}
                                    </p>
                                )}
                                {(exp.start_date || exp.end_date) && (
                                    <p className="text-gray-400 text-xs mt-1">
                                        {exp.start_date || "?"} → {exp.end_date || "Current"}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Pulsante edit visibile solo in modalità edit */}
                        {editable && (
                            <button
                                onClick={() => onEdit?.(idx)}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                            >
                                <Edit2 className="w-4 h-4 text-gray-300" />
                            </button>
                        )}
                    </li>
                    </Link>
                ))
            ) : (
                <li className="bg-white/5 rounded-lg p-4 border border-white/10 text-center text-gray-500">
                    No experience
                </li>
            )}
        </>
    );
}

interface EducationListProps {
    education: any[];
    editable?: boolean;
    onEdit?: (index: number) => void;
}

export function EducationList({ education, editable = false, onEdit }: EducationListProps) {
    return (
        <>
            {education?.length ? (
                education.map((edu, idx) => (
                    <Link href={edu.school.linkedin_url ? ("https://" + edu.school.linkedin_url) : "#"} target="_blank" rel="noopener noreferrer">
                    <li
                        key={idx}
                        className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            {/* Logo */}
                            <CompanyLogo link={edu.school?.logo_url} company={edu.school?.domain || edu.school?.name || ""} />

                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium">
                                    {edu.majors?.join(", ") || "Major not available"}
                                </p>
                                {edu.school?.name && (
                                    <p className="text-gray-300 text-sm">{edu.school.name}</p>
                                )}
                                {(edu.start_date || edu.end_date || edu.degree) && (
                                    <p className="text-gray-400 text-xs mt-1">
                                        {edu.degree && <>{edu.degree} | </>}
                                        {edu.start_date || "?"} → {edu.end_date || "?"}
                                    </p>
                                )}
                            </div>

                            {/* Edit */}
                            {editable && (
                                <button
                                    onClick={() => onEdit?.(idx)}
                                    className="p-1 rounded hover:bg-white/10 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4 text-gray-300" />
                                </button>
                            )}
                        </div>
                    </li>
                    </Link>
                ))
            ) : (
                <li className="bg-white/5 rounded-lg p-4 border border-white/10 text-center text-gray-500">
                    No education
                </li>
            )}
        </>
    );
}

export const calculateProgress = (data: any) => {
  let progress = 0;
  if (data.blog_articles) progress += 50;
  if (data.recruiter_summary || data.recruiter) progress += 30;
  if (data.email || data.email_sent !== undefined) progress += 20;
  return progress;
};