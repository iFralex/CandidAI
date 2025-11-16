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
import { getFileFromFirebase } from '@/actions/onboarding-actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

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

export const Emails = ({ mails, userId }) => {
    const [emails, setEmails] = useState(mails || []);
    const [emailFrom, setEmailFrom] = useState("");
    const [sentInclude, setSentInclude] = useState(false);

    const generateMailExecutable = async (platform = "darwin") => {
        /**
         * Esegue l'escape delle stringhe per AppleScript (per "Mail.app")
         */
        function escapeAppleScript(str) {
            return str.replace(/"/g, '\\"');
        }

        /**
         * Esegue l'escape delle stringhe per PowerShell (per stringhe tra apici singoli)
         */
        function escapePowerShell(str) {
            // Sostituisce un apice singolo ' con due apici singoli ''
            return str.replace(/'/g, "''");
        }

        // 1. Filtra le email
        let filteredMails = [...emails];
        if (!sentInclude) {
            filteredMails = filteredMails.filter(m => !m.email_sent);
        }

        if (filteredMails.length === 0) {
            alert("No emails to process based on the selected filter.");
            return;
        }

        // --- Logica Comune (pre-elaborazione) ---
        // (Questa logica è necessaria per entrambe le piattaforme)

        // Otteniamo tutti gli URL unici per scaricarli una sola volta
        const uniqueUrls = [...new Set(filteredMails.map(m => m.cv_url))];
        const fileCache = {}; // Cache per i dati base64
        const urlToVar = {}; // Mappa da URL a nome variabile (es. CV_0)

        // Mostra un indicatore di caricamento (suggerito)
        // es. setLoading(true, "Downloading attachments...");

        try {
            // Scarichiamo ogni CV una sola volta
            for (const [i, url] of uniqueUrls.entries()) {
                const data = await getFileFromFirebase(url);
                fileCache[url] = data.base64.split(",").pop(); // Rimuove il prefisso "data:..."
                urlToVar[url] = `CV_${i}`;
            }
        } catch (error) {
            console.error("Failed to download attachments:", error);
            alert("Error downloading attachments. Please check console.");
            // es. setLoading(false);
            return;
        }
        // es. setLoading(false);


        // Prepariamo il payload per l'API
        const companyIds = filteredMails.map(m => m.companyId);
        const companyIdsJson = JSON.stringify({ ids: companyIds, userId });

        let content = "";
        let blobType = "text/plain";
        let fileName = "send-mails.txt";

        // --- Logica Specifica per Piattaforma ---

        if (platform === "darwin") {
            // --- macOS (Bash + AppleScript) ---

            blobType = "text/x-sh";
            fileName = "send-mails.command";

            const lines = [
                "#!/usr/bin/env bash",
                "set -e",
                "cleanup() { rm -rf /tmp/email_attach_* 2>/dev/null || true; }",
                "trap cleanup EXIT",
                ""
            ];

            // API Call
            lines.push(`# Send company ID list to server`);
            lines.push(`
status=$(curl -s -o /dev/null -w "%{http_code}" \\
  -X POST -H "Content-Type: application/json" \\
  -d '${companyIdsJson}' \\
  "${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/sent_emails")

if [ "$status" -eq 200 ]; then
  echo "✔️  Email sent status successfully registered."
else
  echo "❌  Error while registering email sent status (HTTP $status)."
fi
`.trim());
            lines.push("");

            // Definiamo le variabili base64 in bash
            for (const url of uniqueUrls) {
                const varName = urlToVar[url];
                lines.push(`${varName}="${fileCache[url]}"`);
            }
            lines.push("");

            // Creiamo le mail
            for (let i = 0; i < filteredMails.length; i++) {
                const m = filteredMails[i];
                m.from = emailFrom; // Assicura che 'from' sia impostato

                const varName = urlToVar[m.cv_url];
                const tempFolder = `/tmp/email_attach_${i}`;
                const tempPath = `${tempFolder}/cv.pdf`;

                lines.push(`mkdir -p "${tempFolder}"`);
                lines.push(`echo "$${varName}" | base64 --decode > "${tempPath}"`);

                lines.push(`osascript <<'EOF'`);
                lines.push(`tell application "Mail"`);
                lines.push(
                    `set msg to make new outgoing message with properties {subject:"${escapeAppleScript(m.subject)}", content:"${escapeAppleScript(m.body)}", sender:"${escapeAppleScript(m.from || "")}"}`
                );
                lines.push(`  tell msg`);
                lines.push(
                    `make new to recipient at end of to recipients with properties {address:"${m.email_address}"}`
                );
                lines.push(
                    `make new attachment with properties {file name:POSIX file "${tempPath}"} at after the last paragraph`
                );
                lines.push(`    set visible to true`);
                lines.push(`  end tell`);
                lines.push(`  activate`);
                lines.push(`end tell`);
                lines.push(`EOF`);
            }

            content = lines.join("\n");

        } else if (platform === "win32") {
            // --- Windows (PowerShell + Outlook COM) ---

            blobType = "text/x-powershell";
            fileName = "send-mails.ps1";

            /**
             * [FUNZIONE HELPER]
             * Converte una stringa (anche UTF-8) in Base64 in modo sicuro.
             */
            function stringAsBase64(str) {
                try {
                    const encoder = new TextEncoder(); // Codifica in UTF-8
                    const data = encoder.encode(str || ""); // Gestisce stringhe null/undefined
                    let binString = '';
                    // Converte l'array di byte (Uint8Array) in una stringa binaria
                    data.forEach((byte) => {
                        binString += String.fromCharCode(byte);
                    });
                    // Codifica la stringa binaria in Base64
                    return btoa(binString);
                } catch (e) {
                    console.error("Errore nella codifica Base64:", e);
                    return btoa("Errore nella codifica"); // Fallback
                }
            }

            // --- 1. PREPARA TUTTI I DATI COME BASE64 ---
            // Codifichiamo *tutto* ciò che è dinamico.
            const apiUrl = process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/sent_emails";
            const apiUrlB64 = stringAsBase64(apiUrl);
            const companyIdsJsonB64 = stringAsBase64(companyIdsJson);

            // --- 2. GENERA SCRIPT (CON SPAZI ASCII GARANTITI) ---
            const lines = [
                "# Imposta la preferenza di errore per fermare lo script in caso di problemi",
                "$ErrorActionPreference = 'Stop'",
                "$ErrorCount = 0",
                "try {",
                "    # Definiamo l'encoding una sola volta all'inizio",
                "    $utf8 = [System.Text.Encoding]::UTF8",
                "",
                "    # 1. Chiamata API per registrare gli invii",
                "    Write-Host 'Registrazione dello stato di invio sul server...'",
                "",
                "    # --- Decodifichiamo i dati per l'API (ora tutti B64) ---",
                `    $apiUrlB64 = '${apiUrlB64}'`,
                `    $apiUrl = $utf8.GetString([System.Convert]::FromBase64String($apiUrlB64))`,
                `    $companyIdsJsonB64 = '${companyIdsJsonB64}'`,
                `    $companyIdsJson = $utf8.GetString([System.Convert]::FromBase64String($companyIdsJsonB64))`,
                "",
                "    try {",
                "        # $companyIdsJson e $apiUrl sono ora variabili PS sicure",
                `        $response = Invoke-WebRequest -Method POST -Uri $apiUrl -Body $companyIdsJson -ContentType "application/json"`,
                `        $status = $response.StatusCode`,
                "        if ($status -eq 200) { Write-Host \"✔️  Email sent status successfully registered.\" }",
                "        else { Write-Host \"✔️  Registrazione completata (HTTP $status).\" }",
                "    } catch {",
                "        $status = \"\"",
                "        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }",
                "        Write-Warning \"❌  Errore durante la chiamata API (HTTP $status): $_.Exception.Message\"",
                "    }",
                "",
                "    # 2. Definizioni delle variabili Base64 per i CV",
            ];

            // Aggiungi le definizioni B64 dei CV (queste sono già sicure)
            for (const url of uniqueUrls) {
                const varName = urlToVar[url];
                lines.push(`    $${varName} = "${fileCache[url]}"`);
            }
            lines.push("");

            lines.push("    # 3. Creazione delle email in Outlook");
            lines.push("    Write-Host 'Avvio di Outlook...'");
            lines.push("    Write-Host 'Avvio di Outlook con il profilo utente...'");
            lines.push("");
            lines.push("    # Se Outlook non è in esecuzione, avvialo così carica il profilo predefinito");
            lines.push("    $running = Get-Process OUTLOOK -ErrorAction SilentlyContinue");
            lines.push("    if (-not $running) {");
            lines.push("        Start-Process 'outlook.exe'");
            lines.push("        Start-Sleep -Seconds 5  # attende il caricamento del profilo");
            lines.push("    } else {");
            lines.push("        # Se è già aperto, forziamo la connessione alla stessa istanza");
            lines.push("        & 'outlook.exe' /recycle");
            lines.push("        Start-Sleep -Seconds 2");
            lines.push("    }");
            lines.push("");
            lines.push("    # Recupera l'istanza già avviata (niente creazione di nuovi profili)");
            lines.push("    $outlook = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')");
            lines.push("");
            // $utf8 è già stato definito sopra

            // Loop per generare i blocchi di creazione email
            for (let i = 0; i < filteredMails.length; i++) {
                const m = filteredMails[i];
                m.from = emailFrom; // Assicura che 'from' sia impostato

                const varName = urlToVar[m.cv_url];
                const tempFolder = `(Join-Path $env:TEMP "email_attach_${i}")`;
                const tempPath = `(Join-Path ${tempFolder} "cv.pdf")`;

                // --- CODIFICA BASE64 PER TUTTI I DATI DELL'EMAIL ---
                const toEmailB64 = stringAsBase64(m.email_address);
                const fromEmailB64 = stringAsBase64(m.from || "");
                const subjectB64 = stringAsBase64(m.subject);
                const bodyB64 = stringAsBase64(m.body);

                lines.push(`    # --- Preparazione Email ${i + 1} ---`);
                lines.push("    try {");
                // Crea file temp per l'allegato
                lines.push(`        New-Item -ItemType Directory -Path ${tempFolder} -Force -ErrorAction SilentlyContinue | Out-Null`);
                lines.push(`        [Convert]::FromBase64String($${varName}) | Set-Content -Path ${tempPath} -Encoding Byte`);
                lines.push("");
                // Crea l'oggetto mail
                lines.push(`        $mail = $outlook.CreateItem(0) # 0 = olMailItem`);

                // Definisce le variabili B64 nello scope di PS
                lines.push(`        $toB64 = '${toEmailB64}'`);
                lines.push(`        $fromB64 = '${fromEmailB64}'`);
                lines.push(`        $subjectB64 = '${subjectB64}'`);
                lines.push(`        $bodyB64 = '${bodyB64}'`);
                lines.push("");

                // Decodifica i dati
                lines.push(`        $toEmail = $utf8.GetString([System.Convert]::FromBase64String($toB64))`);
                lines.push(`        $fromEmail = $utf8.GetString([System.Convert]::FromBase64String($fromB64))`);
                lines.push(`        $subject = $utf8.GetString([System.Convert]::FromBase64String($subjectB64))`);
                lines.push(`        $body = $utf8.GetString([System.Convert]::FromBase64String($bodyB64))`);

                // Imposta l'account "From"
                lines.push(`        if ($fromEmail) {`);
                lines.push(`            try {`);
                lines.push(`                $account = $outlook.Session.Accounts | Where-Object { $_.SmtpAddress -eq $fromEmail }`);
                lines.push(`                if ($null -ne $account) { $mail.SendUsingAccount = $account }`);
                lines.push(`                else { Write-Warning "Account '$fromEmail' non trovato in Outlook. Verrà usato l'account predefinito." }`);
                lines.push(`            } catch { Write-Warning "Impossibile impostare l'account 'From': $_.Exception.Message" }`);
                lines.push(`        }`);

                // Imposta destinatario, oggetto e corpo (usando le variabili decodificate)
                lines.push(`        $mail.To = $toEmail`);
                lines.push(`        $mail.Subject = $subject`);
                lines.push(`        $mail.Body = $body`);

                // Aggiungi allegato
                lines.push(`        $mail.Attachments.Add(${tempPath})`);

                // Mostra l'email all'utente
                lines.push(`        $mail.Display()`);
                lines.push(`        Write-Host "✔️  Email per $toEmail pronta."`);
                lines.push("    } catch {");
                lines.push(`        Write-Error "❌  Errore nella creazione email: $_.Exception.Message"`);
                lines.push("        $ErrorCount++");
                lines.push("    }");
                lines.push("");
            }

            lines.push("} finally {");
            lines.push(`    # 4. Pulizia dei file temporanei`);
            lines.push(`    Write-Host "Pulizia dei file temporanei..."`);
            lines.push(`    Remove-Item -Path (Join-Path $env:TEMP "email_attach_*") -Recurse -Force -ErrorAction SilentlyContinue`);
            lines.push("}");
            lines.push("");
            lines.push(`if ($ErrorCount -gt 0) { Write-Warning "$ErrorCount errori riscontrati durante la creazione delle email." }`);
            lines.push(`else { Write-Host "Tutte le email sono state processate con successo." }`);
            lines.push(`Write-Host "Script terminato. Premi Invio per chiudere."`);
            lines.push(`Read-Host`);

            content = lines.join("\r\n"); // Windows usa CRLF

        } else {
            alert(`Platform "${platform}" is not supported.`);
            return;
        }

        // --- Download dello Script Generato ---
        const blob = new Blob([content], { type: blobType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto p-6 rounded-xl shadow-md space-y-4">
            <Input
                type="email"
                placeholder="Sender Email Address"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
            />

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="sentInclude"
                    checked={sentInclude}
                    onCheckedChange={(e) => setSentInclude(e)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-400"
                />
                <label htmlFor="sentInclude" className="text-gray-700 select-none">
                    Include sent emails in the script
                </label>
            </div>
            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                    <Button
                        onClick={() => generateMailExecutable("win32")}
                    >
                        Generate Windows script
                    </Button>
                    <p>powershell -ExecutionPolicy Bypass -File .\send-mails.ps1</p>
                </div>
                <div className="flex-1">
                    <Button
                        onClick={() => generateMailExecutable("darwin")}
                    >
                        Generate MacOS script
                    </Button>
                    <p>chmod +x send_mails.command && ./send_mails.command</p>
                </div>
            </div>

            <div className="text-sm text-gray-500 space-y-1">


            </div>
        </div>
    );
};

const EmailsFull = ({ mails, onSendEmails, onUnsendEmail, userId }) => {
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

    const [emailFrom, setEmailFrom] = useState("");
    const [sentInclude, setSentInclude] = useState(false);

    const generateMailExecutable = async (platform = "darwin") => {
        function escapeAppleScript(str) {
            return str.replace(/"/g, '\\"');
        }

        // ✅ Filter emails based on sentInclude
        let filteredMails = emails;
        console.log(filteredMails, filteredMails.length)
        if (!sentInclude) {
            filteredMails = mails.filter(m => !m.email_sent);
        }

        if (filteredMails.length === 0) {
            alert("No emails to process based on the selected filter.");
            return;
        }

        let content = "";

        if (platform === "darwin") {
            const lines = [
                "#!/usr/bin/env bash",
                "set -e",
                "cleanup() { rm -f /tmp/email_attach_* 2>/dev/null || true; }",
                "trap cleanup EXIT",
                ""
            ];

            // 1) Company IDs list
            const companyIds = filteredMails.map(m => m.companyId);
            const companyIdsJson = JSON.stringify({ ids: companyIds, userId });

            // 2) Server notification
            lines.push(`# Send company ID list to server`);

            lines.push(`
status=$(curl -s -o /dev/null -w "%{http_code}" \\
  -X POST -H "Content-Type: application/json" \\
  -d '${companyIdsJson}' \\
  "${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/sent_emails")

if [ "$status" -eq 200 ]; then
  echo "✔️  Email sent status successfully registered."
else
  echo "❌  Error while registering email sent status (HTTP $status)."
fi
`.trim());
            lines.push("");

            const uniqueUrls = [...new Set(filteredMails.map(m => m.cv_url))];
            const fileCache = {};
            const urlToVar = {};

            // Download CVs
            for (const [i, url] of uniqueUrls.entries()) {
                const data = await getFileFromFirebase(url);
                fileCache[url] = data.base64.split(",").pop();
                urlToVar[url] = `CV_${i}`;
            }

            // Base64 variables
            for (const url of uniqueUrls) {
                const varName = urlToVar[url];
                lines.push(`${varName}="${fileCache[url]}"`);
            }
            lines.push("");

            // Duplicate first email (your existing logic)
            filteredMails.push(filteredMails[0]);

            for (let i = 0; i < filteredMails.length; i++) {
                const m = filteredMails[i];
                m.from = emailFrom;

                const varName = urlToVar[m.cv_url];
                // keep unique temp file but rename attachment as cv.pdf
                const tempPath = `/tmp/email_attach_${i}.pdf`;
                const attachmentName = "cv.pdf";

                lines.push(`echo "$${varName}" | base64 --decode > "${tempPath}"`);
                lines.push(`osascript <<'EOF'`);
                lines.push(`tell application "Mail"`);
                lines.push(
                    `set msg to make new outgoing message with properties {subject:"${escapeAppleScript(m.subject)}", content:"${escapeAppleScript(m.body)}", sender:"${escapeAppleScript(m.from || "")}"}`
                );
                lines.push(`  tell msg`);
                lines.push(
                    `make new to recipient at end of to recipients with properties {address:"${m.email_address}"}`
                );
                // qui cambiamo solo il nome dell’allegato
                lines.push(
                    `make new attachment with properties {file name:POSIX file "${tempPath}", name:"${attachmentName}"} at after the last paragraph`
                );
                lines.push(`    set visible to true`);
                lines.push(`  end tell`);
                lines.push(`  activate`);
                lines.push(`end tell`);
                lines.push(`EOF`);
            }

            content = lines.join("\n");
        }

        // Download script
        const blob = new Blob([content], { type: platform === "darwin" ? "text/x-sh" : "text/x-powershell" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = platform === "darwin" ? "send-mails.command" : "send-mails.ps1";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="">
            {console.log(emails)}
            <Input type="email" placeholder="Sender Email Address" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} />
            <Checkbox checked={sentInclude} onCheckedChange={setSentInclude}>Include sent emails in the script</Checkbox>
            <Button onClick={() => generateMailExecutable("windows")}>Generate Windows script</Button>
            <Button onClick={() => generateMailExecutable("darwin")}>Generate MacOS script</Button>
            <p>chmod +x send_mails.command && ./send_mails.command</p>
            {false && <div className="max-w-7xl mx-auto">
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
            </div>}
        </div>
    );
};