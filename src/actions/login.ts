const a = () => {
    return (<>
        {analysisComplete && !analyzing && (
                <motion.div
                    key="step3"
                    className="max-w-4xl mx-auto"
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    variants={containerVariants}
                >
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-4">Profile Analysis Complete</h2>
                        <p className="text-lg text-gray-400">
                            Review your profile summary and ideal recruiter persona. You can edit anything before proceeding.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <motion.div variants={cardVariants} className="h-full">
                            <Card className="p-6 h-full">
                                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-violet-400" />
                                    Your Profile Summary
                                </h3>

                                <div className="space-y-6">
                                    {/* Name & Title */}
                                    <div className="pb-4 border-b border-white/10">
                                        <p className="text-sm text-gray-400 mb-2">Name & Title</p>

                                        {/* Flex container per nome a sinistra e location a destra */}
                                        <div className="flex justify-between items-center">
                                            <p className="text-white font-semibold text-lg">{profileSummary?.name}</p>
                                            {profileSummary?.location && (
                                                <div className="flex items-center text-gray-300 space-x-2">
                                                    <Flag size={16} />
                                                    <span>{profileSummary.location}</span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-gray-300">{profileSummary?.title}</p>
                                    </div>

                                    {/* Key Skills */}
                                    <div>
                                        <p className="text-sm text-gray-400 mb-3">Key Skills</p>
                                        <div className="flex flex-wrap gap-2">
                                            {profileSummary?.skills?.map((skill: string, index: number) => (
                                                <Badge key={index} className="font-bold">
                                                    {skill}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Experience */}
                                    <div>
                                        <p className="text-sm text-gray-400 mb-3">Experience</p>
                                        <ul className="space-y-3">
                                            {profileSummary?.experience?.map((exp: any, idx: number) => (
                                                <li key={idx} className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        {/* Logo aziendale */}
                                                        {exp.logo ? (
                                                            <img
                                                                src={exp.logo}
                                                                alt={exp.company?.name || "Company"}
                                                                className="w-10 h-10 rounded-lg object-contain bg-white/5 p-1.5 border border-white/10 flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                                <span className="text-violet-400 text-xs font-bold">
                                                                    {exp.company?.name?.charAt(0) || "?"}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            {/* Titolo ruolo */}
                                                            <p className="text-white font-medium">
                                                                {exp.title?.name || "Role not available"}
                                                            </p>

                                                            {/* Azienda */}
                                                            {exp.company?.name && (
                                                                <p className="text-gray-300 text-sm">
                                                                    {exp.company.name}
                                                                    {exp.company.location?.name && ` · ${exp.company.location.name}`}
                                                                </p>
                                                            )}

                                                            {/* Date */}
                                                            {(exp.start_date || exp.end_date) && (
                                                                <p className="text-gray-400 text-xs mt-1">
                                                                    {exp.start_date || "?"} → {exp.end_date || "Current"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Education */}
                                    <div>
                                        <p className="text-sm text-gray-400 mb-3">Education</p>
                                        <ul className="space-y-3">
                                            {profileSummary?.education?.map((edu: any, idx: number) => (
                                                <li key={idx} className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        {/* Logo università */}
                                                        {edu.logo ? (
                                                            <img
                                                                src={edu.logo}
                                                                alt={edu.school?.name || "School"}
                                                                className="w-10 h-10 rounded-lg object-contain bg-white/5 p-1.5 border border-white/10 flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                                <span className="text-blue-400 text-xs font-bold">
                                                                    {edu.school?.name?.charAt(0) || "?"}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            {/* Corso di laurea / indirizzo */}
                                                            <p className="text-white font-medium">
                                                                {edu.majors?.join(", ") || "Address not available"}
                                                            </p>

                                                            {/* Nome scuola */}
                                                            {edu.school?.name && (
                                                                <p className="text-gray-300 text-sm">{edu.school.name}</p>
                                                            )}

                                                            {/* Date */}
                                                            {(edu.start_date || edu.end_date) && (
                                                                <p className="text-gray-400 text-xs mt-1">
                                                                    {edu.start_date || "?"} → {edu.end_date || "?"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div
                            variants={cardVariants}
                            className="flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                        >
                            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                                <Target className="w-5 h-5 mr-2 text-violet-400" />
                                Ideal Recruiter Persona
                            </h3>

                            <div className="flex-1">
                                <Textarea
                                    value={recruiterPersona}
                                    onChange={(e) => setRecruiterPersona(e.target.value)}
                                    className="w-full h-full p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                    placeholder="Describe your ideal recruiter..."
                                />
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                    >
                        <button
                            onClick={handleContinue}
                            disabled={isPending}
                            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue Setup</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <p className="text-sm text-gray-500 mt-4">
                            This information helps us find the perfect recruiters for you
                        </p>
                    </motion.div>
                </motion.div>
            )}</>
        )}