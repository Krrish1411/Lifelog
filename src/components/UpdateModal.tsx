import { useEffect, useState } from "react";
import { Download, ExternalLink, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { Modal, Btn } from "./ui";
import { AppVersionInfo, APP_VERSION } from "../types";
import { detectDistribution, AppDistribution } from "../utils/native";

interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
  data: AppVersionInfo | null;
}

export function UpdateModal({ open, onClose, data }: UpdateModalProps) {
  const [dist, setDist] = useState<AppDistribution>("web");

  useEffect(() => {
    if (open) {
      detectDistribution().then(setDist);
    }
  }, [open]);

  if (!data) return null;

  // Compute platform-specific primary target
  let platformLabel = "Your Platform";
  let targetDownloadUrl: string | undefined = undefined;
  let targetFilename = "Update Package";
  let helperNote = "Download the latest release package.";

  switch (dist) {
    case "windows-portable":
      platformLabel = "Windows (Portable)";
      targetDownloadUrl = data.downloads.windowsPortable || data.downloads.windows;
      targetFilename = "LifeLog-Windows-Portable.exe";
      helperNote = "Download and replace your existing portable executable.";
      break;
    case "windows-setup":
      platformLabel = "Windows (Installer)";
      targetDownloadUrl = data.downloads.windows;
      targetFilename = "LifeLog-Windows-Setup.exe";
      helperNote = "Run the setup installer to seamlessly update your LifeLog installation.";
      break;
    case "linux-appimage":
      platformLabel = "Linux (.AppImage)";
      targetDownloadUrl = data.downloads.linux;
      targetFilename = "LifeLog-Linux-x86_64.AppImage";
      helperNote = "Replace your existing AppImage and ensure it is marked executable (chmod +x).";
      break;
    case "linux-deb":
      platformLabel = "Linux (Debian / Ubuntu)";
      targetDownloadUrl = data.downloads.linuxDeb || data.downloads.linux;
      targetFilename = "LifeLog-Linux-amd64.deb";
      helperNote = "Install using your software manager or run 'sudo dpkg -i'.";
      break;
    case "mac":
      platformLabel = "macOS (Apple Silicon & Intel)";
      targetDownloadUrl = data.downloads.mac;
      targetFilename = "LifeLog-macOS.dmg";
      helperNote = "Open the DMG disk image and drag LifeLog to your Applications folder.";
      break;
    case "android":
      platformLabel = "Android (APK)";
      targetDownloadUrl = data.downloads.android;
      targetFilename = "LifeLog-Android.apk";
      helperNote = "Tap to download and install. Your local offline database will be fully preserved.";
      break;
    case "web":
    default:
      platformLabel = "Web / PWA";
      targetDownloadUrl = undefined;
      targetFilename = "Automatic Service Worker Refresh";
      helperNote = "LifeLog Web updates automatically in the background via Service Worker!";
      break;
  }

  const githubReleaseUrl = `https://github.com/Krrish1411/Lifelog-Releases/releases/tag/v${data.version}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="text-amber-400" size={18} />
          <span>LifeLog v{data.version} Available</span>
        </div>
      }
      width={520}
      footer={
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
          <span className="text-[11px] font-mono text-[var(--mut)]">
            Released {data.releaseDate} • Running v{APP_VERSION}
          </span>
          <Btn variant="ghost" onClick={onClose} className="font-semibold text-xs self-end sm:self-auto">
            Close
          </Btn>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Changelog Highlights */}
        <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs text-[var(--text)]">
          <div className="font-bold text-indigo-400 mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>What's New in v{data.version}:</span>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-[var(--text)] font-medium leading-relaxed">
            {data.changelog.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>

        {/* Single Targeted Platform Download Card */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] mb-2">
            Targeted Update for: <span className="text-[var(--text)] normal-case font-semibold">{platformLabel}</span>
          </div>

          {dist === "web" ? (
            <div
              className="p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[var(--text)]">Instant Web Update</div>
                <div className="text-[11px] text-[var(--mut)]">{helperNote}</div>
              </div>
              <Btn
                variant="primary"
                size="sm"
                onClick={() => {
                  window.location.reload();
                }}
                className="font-bold gap-1.5 shrink-0"
              >
                <RefreshCw size={13} />
                <span>Reload App</span>
              </Btn>
            </div>
          ) : targetDownloadUrl ? (
            <div
              className="p-3.5 rounded-xl border flex flex-col gap-2.5"
              style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">{targetFilename}</div>
                  <div className="text-[11px] text-[var(--mut)] leading-normal mt-0.5">{helperNote}</div>
                </div>
              </div>
              <a
                href={targetDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-[var(--accent)] text-white text-xs font-bold hover:brightness-110 active:scale-[0.99] transition shadow-sm"
              >
                <Download size={14} />
                <span>Download Update ({platformLabel})</span>
              </a>
            </div>
          ) : null}
        </div>

        {/* Universal GitHub Release Hub Link */}
        <div className="pt-2 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px]">
          <span className="text-[var(--mut)] font-medium">Need another OS or checksums?</span>
          <a
            href={githubReleaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-[var(--accent)] hover:underline"
          >
            <span>Full GitHub Release & Other Platforms</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </Modal>
  );
}
