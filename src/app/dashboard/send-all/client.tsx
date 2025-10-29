"use client"

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail,
    Send,
    Check,
    X,
    Upload,
    FileText,
    Filter,
    Calendar,
    Trash2,
    Edit,
    Loader2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Download
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock data for demonstration
const mockMails = [
    {
        id: 1,
        email_address: "john.doe@example.com",
        subject: "Application for Senior Developer Position",
        body: "Dear Hiring Manager,\n\nI am writing to express my interest in the Senior Developer position...",
        email_sent: false,
        cv_url: "https://example.com/default-cv.pdf"
    },
    {
        id: 2,
        email_address: "jane.smith@company.com",
        subject: "Full Stack Developer Opportunity",
        body: "Hello,\n\nI came across your job posting and I believe my skills align perfectly...",
        email_sent: new Date('2025-10-15'),
        cv_url: "https://example.com/default-cv.pdf"
    },
    {
        id: 3,
        email_address: "hr@startup.io",
        subject: "Software Engineer Application",
        body: "Dear Team,\n\nI am excited to apply for the Software Engineer role...",
        email_sent: false,
        cv_url: "https://example.com/default-cv.pdf"
    }
];

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

export const Emails = ({ mails = mockMails, onSendEmails, onUnsendEmail }) => {
    const [emails, setEmails] = useState(mails);
    const [filter, setFilter] = useState('all'); // 'all', 'unsent', 'sent', 'date'
    const [dateFilter, setDateFilter] = useState({ after: '', before: '' });
    const [selectedEmails, setSelectedEmails] = useState(new Set());
    const [uploadedCVs, setUploadedCVs] = useState([]);
    const [cvAssignments, setCvAssignments] = useState({});
    const [expandedEmail, setExpandedEmail] = useState(null);
    const [showBulkSendDialog, setShowBulkSendDialog] = useState(false);
    const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);
    const [bulkSendConfig, setBulkSendConfig] = useState({
        os: 'windows',
        senderEmail: '',
        mode: 'draft' // 'draft' or 'send'
    });
    const [isGenerating, setIsGenerating] = useState(false);

    // Filter emails
    const filteredEmails = useMemo(() => {
        return emails.filter(email => {
            if (filter === 'unsent') return email.email_sent === false;
            if (filter === 'sent') return email.email_sent !== false;
            if (filter === 'date' && email.email_sent !== false) {
                const sentDate = new Date(email.email_sent);
                if (dateFilter.after && sentDate < new Date(dateFilter.after)) return false;
                if (dateFilter.before && sentDate > new Date(dateFilter.before)) return false;
            }
            return true;
        });
    }, [emails, filter, dateFilter]);

    const handleEmailUpdate = (id, field, value) => {
        setEmails(prev => prev.map(email =>
            email.id === id ? { ...email, [field]: value } : email
        ));
    };

    const handleCVUpload = (e) => {
        const files = Array.from(e.target.files);
        setUploadedCVs(prev => [...prev, ...files.map((file, idx) => ({
            id: `cv-${Date.now()}-${idx}`,
            name: file.name,
            file: file
        }))]);
    };

    const handleCVAssign = (emailId, cvId) => {
        setCvAssignments(prev => ({ ...prev, [emailId]: cvId }));
    };

    const handleBulkCVAssign = (cvId, emailIds) => {
        const newAssignments = { ...cvAssignments };
        emailIds.forEach(id => {
            newAssignments[id] = cvId;
        });
        setCvAssignments(newAssignments);
    };

    const toggleEmailSelection = (id) => {
        setSelectedEmails(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAllUnsent = () => {
        const unsentIds = emails.filter(e => e.email_sent === false).map(e => e.id);
        setSelectedEmails(new Set(unsentIds));
    };

    const handleBulkSend = async () => {
        if (selectedEmails.size === 0 || !bulkSendConfig.senderEmail) return;

        setIsGenerating(true);
        const selectedEmailsData = emails.filter(e => selectedEmails.has(e.id)).map(e => ({
            ...e,
            cv_url: cvAssignments[e.id] ? uploadedCVs.find(cv => cv.id === cvAssignments[e.id])?.file : e.cv_url
        }));

        try {
            await generateMailExecutable?.(selectedEmailsData, bulkSendConfig);
            setShowBulkSendDialog(false);
            setShowInstructionsDialog(true);
        } catch (error) {
            console.error('Error generating executable:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUnsend = (id) => {
        setEmails(prev => prev.map(email =>
            email.id === id ? { ...email, email_sent: false } : email
        ));
        onUnsendEmail?.(id);
    };

    const handleSendSingle = (id) => {
        setEmails(prev => prev.map(email =>
            email.id === id ? { ...email, email_sent: new Date() } : email
        ));
    };

    const getCVForEmail = (emailId) => {
        const cvId = cvAssignments[emailId];
        if (cvId) {
            return uploadedCVs.find(cv => cv.id === cvId);
        }
        return null;
    };

    const generateMailExecutable = async (platform = "darwin") => {
        function escapeAppleScript(str) {
            return str.replace(/"/g, '\\"'); // scappa i doppi apici
        }

        let content = "";

        if (platform === "darwin") {
            const lines = [
                "#!/usr/bin/env bash",
                "set -e",
                "cleanup() { rm -f /tmp/email_attach_* 2>/dev/null || true; }",
                "trap cleanup EXIT",
            ];

            // Usare for...of per aspettare ogni allegato
            mails.push(mails[0])
            for (let i = 0; i < mails.length; i++) {
                const m = mails[i];

                // Ottieni allegato da Firebase
                const fileData = await getFileFromFirebase(
                    "https://firebasestorage.googleapis.com/v0/b/candidai-1bda0.firebasestorage.app/o/cv%2FWGF1EmgNV2TT8TrgWVxNg7dWWcS2%2FCV.pdf?alt=media&token=70f9f6f2-d731-4b7a-a66c-34c34e4795e3"
                );

                m.attached = fileData.base64;
                m.to = "jusborucka@gmail.com";
                m.from = "ifralex.business@gmail.com";

                const base64 = m.attached.split(",").pop(); // togli prefisso data:
                const path = `/tmp/email_attach_${i}.pdf`;

                lines.push(`echo "${base64}" | base64 --decode > "${path}"`);
                lines.push(`osascript <<'EOF'`);
                lines.push(`tell application "Mail"`);
                lines.push(
                    `set msg to make new outgoing message with properties {subject:"${escapeAppleScript(m.subject)}", content:"${escapeAppleScript(m.body)}", sender:"${escapeAppleScript(m.from || "")}"}`
                );
                lines.push(`  tell msg`);
                lines.push(
                    `    make new to recipient at end of to recipients with properties {address:"${m.to}"}`
                );
                lines.push(
                    `    make new attachment with properties {file name:POSIX file "${path}"} at after the last paragraph`
                );
                lines.push(`    set visible to true`);
                lines.push(`  end tell`);
                lines.push(`  activate`);
                lines.push(`end tell`);
                lines.push(`EOF`);
            }

            content = lines.join("\n");
        }

        // Creazione blob e download
        const blob = new Blob([content], { type: platform === "darwin" ? "text/x-sh" : "text/x-powershell" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = platform === "darwin" ? "send-mails.command" : "send-mails.ps1";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-bold text-white mb-2">Email Campaign Manager</h1>
                    <p className="text-gray-300">Manage and send your job application emails</p>
                </motion.div>

                {/* Action Bar */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mb-6"
                >
                    <Card className="p-6 bg-gray-800/50 backdrop-blur border-gray-700">
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex gap-3 items-center flex-wrap">
                                <Button
                                    onClick={() => setShowBulkSendDialog(true)}
                                    className="bg-violet-600 hover:bg-violet-700"
                                    disabled={selectedEmails.size === 0}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Send Selected ({selectedEmails.size})
                                </Button>

                                <Button
                                    onClick={selectAllUnsent}
                                    variant="outline"
                                >
                                    Select All Unsent
                                </Button>

                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf"
                                        onChange={handleCVUpload}
                                        className="hidden"
                                    />
                                    <Button variant="outline">
                                        <span>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload CVs ({uploadedCVs.length})
                                        </span>
                                    </Button>
                                </label>
                            </div>

                            {/* Filter */}
                            <div className="flex gap-2 items-center">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
                                >
                                    <option value="all">All Emails</option>
                                    <option value="unsent">Unsent</option>
                                    <option value="sent">Sent</option>
                                    <option value="date">By Date</option>
                                </select>

                                {filter === 'date' && (
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            type="date"
                                            value={dateFilter.after}
                                            onChange={(e) => setDateFilter(prev => ({ ...prev, after: e.target.value }))}
                                            className="w-40"
                                            placeholder="After"
                                        />
                                        <Input
                                            type="date"
                                            value={dateFilter.before}
                                            onChange={(e) => setDateFilter(prev => ({ ...prev, before: e.target.value }))}
                                            className="w-40"
                                            placeholder="Before"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Uploaded CVs Display */}
                        {uploadedCVs.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Uploaded CVs</h3>
                                <div className="flex flex-wrap gap-2">
                                    {uploadedCVs.map(cv => (
                                        <div key={cv.id} className="bg-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-violet-400" />
                                            <span className="text-sm text-white">{cv.name}</span>
                                            <button
                                                onClick={() => setUploadedCVs(prev => prev.filter(c => c.id !== cv.id))}
                                                className="text-gray-400 hover:text-red-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                </motion.div>

                {/* Email List */}
                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredEmails.map((email, index) => (
                            <motion.div
                                key={email.id}
                                variants={cardVariants}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="p-6 bg-gray-800/50 backdrop-blur border-gray-700">
                                    <div className="flex items-start gap-4">
                                        {/* Checkbox */}
                                        {email.email_sent === false && (
                                            <input
                                                type="checkbox"
                                                checked={selectedEmails.has(email.id)}
                                                onChange={() => toggleEmailSelection(email.id)}
                                                className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700"
                                            />
                                        )}

                                        {/* Email Content */}
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <Mail className="w-5 h-5 text-violet-400" />
                                                    <span className="text-white font-medium">{email.email_address}</span>
                                                    {email.email_sent !== false && (
                                                        <span className="flex items-center gap-1 text-sm text-green-400">
                                                            <Check className="w-4 h-4" />
                                                            Sent {new Date(email.email_sent).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    {email.email_sent === false ? (
                                                        <Button
                                                            onClick={() => handleSendSingle(email.id)}
                                                            size="sm"
                                                            className="bg-violet-600 hover:bg-violet-700"
                                                        >
                                                            <Send className="w-4 h-4 mr-2" />
                                                            Send Now
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            onClick={() => handleUnsend(email.id)}
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Unsend
                                                        </Button>
                                                    )}
                                                    <Button
                                                        onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                                                        size="sm"
                                                        variant="ghost"
                                                    >
                                                        {expandedEmail === email.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            {expandedEmail === email.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-4"
                                                >
                                                    <div>
                                                        <label className="text-gray-300 text-sm font-medium mb-2 block">Subject</label>
                                                        <Input
                                                            value={email.subject}
                                                            onChange={(e) => handleEmailUpdate(email.id, 'subject', e.target.value)}
                                                            disabled={email.email_sent !== false}
                                                            className="bg-gray-700 border-gray-600 text-white"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-gray-300 text-sm font-medium mb-2 block">Body</label>
                                                        <Textarea
                                                            value={email.body}
                                                            onChange={(e) => handleEmailUpdate(email.id, 'body', e.target.value)}
                                                            disabled={email.email_sent !== false}
                                                            rows={8}
                                                            className="bg-gray-700 border-gray-600 text-white"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-gray-300 text-sm font-medium mb-2 block">CV Attachment</label>
                                                        <div className="flex gap-2 items-center">
                                                            <select
                                                                value={cvAssignments[email.id] || 'default'}
                                                                onChange={(e) => handleCVAssign(email.id, e.target.value === 'default' ? null : e.target.value)}
                                                                disabled={email.email_sent !== false}
                                                                className="flex-1 bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
                                                            >
                                                                <option value="default">Default CV</option>
                                                                {uploadedCVs.map(cv => (
                                                                    <option key={cv.id} value={cv.id}>{cv.name}</option>
                                                                ))}
                                                            </select>
                                                            {getCVForEmail(email.id) && (
                                                                <FileText className="w-5 h-5 text-violet-400" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {filteredEmails.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12"
                    >
                        <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">No emails match your filter</p>
                    </motion.div>
                )}

                {/* Bulk Send Dialog */}
                <Dialog open={showBulkSendDialog} onOpenChange={setShowBulkSendDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Send Selected Emails</DialogTitle>
                            <DialogDescription>
                                Configure how you want to send {selectedEmails.size} emails
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Operating System</label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={bulkSendConfig.os === 'windows' ? 'default' : 'outline'}
                                        onClick={() => setBulkSendConfig(prev => ({ ...prev, os: 'windows' }))}
                                        className="flex-1"
                                    >
                                        Windows
                                    </Button>
                                    <Button
                                        variant={bulkSendConfig.os === 'macos' ? 'default' : 'outline'}
                                        onClick={() => setBulkSendConfig(prev => ({ ...prev, os: 'macos' }))}
                                        className="flex-1"
                                    >
                                        macOS
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">Sender Email Address</label>
                                <Input
                                    type="email"
                                    placeholder="your.email@example.com"
                                    value={bulkSendConfig.senderEmail}
                                    onChange={(e) => setBulkSendConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">Send Mode</label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={bulkSendConfig.mode === 'draft' ? 'default' : 'outline'}
                                        onClick={() => setBulkSendConfig(prev => ({ ...prev, mode: 'draft' }))}
                                        className="flex-1"
                                    >
                                        Create Drafts
                                    </Button>
                                    <Button
                                        variant={bulkSendConfig.mode === 'send' ? 'default' : 'outline'}
                                        onClick={() => setBulkSendConfig(prev => ({ ...prev, mode: 'send' }))}
                                        className="flex-1"
                                    >
                                        Send Automatically
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button
                                onClick={handleBulkSend}
                                disabled={!bulkSendConfig.senderEmail || isGenerating}
                                className="bg-violet-600 hover:bg-violet-700"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Generate Executable
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Instructions Dialog */}
                <Dialog open={showInstructionsDialog} onOpenChange={setShowInstructionsDialog}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Executable Generated Successfully</DialogTitle>
                            <DialogDescription>
                                Follow these instructions to run the email sender
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="bg-violet-900/30 border border-violet-600 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-violet-400 mt-0.5" />
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-white">
                                            {bulkSendConfig.os === 'windows' ? 'Windows Instructions' : 'macOS Instructions'}
                                        </h4>
                                        {bulkSendConfig.os === 'windows' ? (
                                            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                                                <li>Download the generated .exe file</li>
                                                <li>Right-click and select "Run as administrator"</li>
                                                <li>If Windows Defender blocks it, click "More info" then "Run anyway"</li>
                                                <li>The program will open your email client and {bulkSendConfig.mode === 'draft' ? 'create drafts' : 'send emails'}</li>
                                                <li>Wait for the process to complete</li>
                                            </ol>
                                        ) : (
                                            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                                                <li>Download the generated .app file</li>
                                                <li>Open Terminal and navigate to the download folder</li>
                                                <li>Run: chmod +x filename.app</li>
                                                <li>Double-click the .app file to execute</li>
                                                <li>If blocked by Gatekeeper, go to System Preferences → Security & Privacy → click "Open Anyway"</li>
                                                <li>The program will {bulkSendConfig.mode === 'draft' ? 'create drafts' : 'send emails'} via your email client</li>
                                            </ol>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-white mb-1">Important Notes</h4>
                                        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                                            <li>Make sure your email client is configured with the sender address</li>
                                            <li>The process may take several minutes for large batches</li>
                                            <li>Do not close your email client during the process</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button onClick={() => setShowInstructionsDialog(false)}>
                                Got it!
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};