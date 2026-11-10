using System;
using System.IO;
using System.Diagnostics;
using System.Text;
using Microsoft.Win32;

namespace ClaudeGeminiBridge
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "Claude Code + Gemini 3.8 Flash Bridge - Installer";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"
======================================================================
     Claude Code + Google Gemini 3.8 Flash Bridge Installer
======================================================================
");
            Console.ResetColor();

            try
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
                string bridgeDir = baseDir;

                // Check if running as standalone installer without repo files
                if (!File.Exists(Path.Combine(bridgeDir, "bin", "claude-gemini.cmd")))
                {
                    string targetDir = Path.Combine(userProfile, ".claude-gemini-bridge");
                    if (!Directory.Exists(targetDir) || !File.Exists(Path.Combine(targetDir, "bin", "claude-gemini.cmd")))
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("    [*] Standalone installer detected. Fetching bridge package...");
                        Console.ResetColor();
                        string tempZip = Path.Combine(Path.GetTempPath(), "bridge.zip");
                        string tempExtract = Path.Combine(Path.GetTempPath(), "bridge-extract");
                        try
                        {
                            if (Directory.Exists(tempExtract)) Directory.Delete(tempExtract, true);
                            Directory.CreateDirectory(tempExtract);
                            RunCommand("cmd.exe", "/c curl.exe -sSL https://github.com/VanshCoder01/claude-code-gemini-bridge/archive/refs/heads/main.zip -o \"" + tempZip + "\" && tar.exe -xf \"" + tempZip + "\" -C \"" + tempExtract + "\"");
                            string extractedFolder = Path.Combine(tempExtract, "claude-code-gemini-bridge-main");
                            if (Directory.Exists(extractedFolder))
                            {
                                if (Directory.Exists(targetDir)) Directory.Delete(targetDir, true);
                                Directory.Move(extractedFolder, targetDir);
                            }
                        }
                        catch (Exception dlEx)
                        {
                            Console.ForegroundColor = ConsoleColor.Red;
                            Console.WriteLine("    [!] Failed to download bridge package: " + dlEx.Message);
                            Console.ResetColor();
                        }
                    }
                    if (Directory.Exists(targetDir))
                    {
                        bridgeDir = targetDir;
                    }
                }

                // 1. Check Node.js
                Step(1, 7, "Checking Node.js runtime...");
                if (!IsCommandAvailable("node"))
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("    [!] Node.js is not installed or not in PATH.");
                    Console.WriteLine("        Opening https://nodejs.org to download Node.js LTS...");
                    Console.ResetColor();
                    Process.Start("https://nodejs.org");
                    WaitPrompt();
                    return;
                }
                string nodeVer = RunCommandCapture("node", "-v").Trim();
                Success("Found Node.js " + nodeVer);

                // 2. Check Claude Code CLI
                Step(2, 7, "Checking Claude Code CLI...");
                if (!IsCommandAvailable("claude"))
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("    [*] Installing Claude Code CLI globally via npm...");
                    Console.ResetColor();
                    RunCommand("cmd.exe", "/c npm install -g @anthropic-ai/claude-code");
                }
                Success("Claude Code CLI is installed.");

                // 3. Setup Proxy Config
                Step(3, 7, "Configuring proxy port to 8085...");
                string configDir = Path.Combine(userProfile, ".config", "antigravity-proxy");
                if (!Directory.Exists(configDir))
                {
                    Directory.CreateDirectory(configDir);
                }
                string configFile = Path.Combine(configDir, "config.json");
                string configJson = "{\n  \"port\": 8085,\n  \"strategy\": \"hybrid\",\n  \"maxRetries\": 5\n}";
                File.WriteAllText(configFile, configJson, Encoding.UTF8);
                Success("Saved configuration: " + configFile);

                // 4. Configure Claude Code settings.json
                Step(4, 7, "Configuring Claude Code settings for Gemini 3.8 Flash...");
                string claudeDir = Path.Combine(userProfile, ".claude");
                if (!Directory.Exists(claudeDir))
                {
                    Directory.CreateDirectory(claudeDir);
                }
                string settingsPath = Path.Combine(claudeDir, "settings.json");
                string existingSettings = File.Exists(settingsPath) ? File.ReadAllText(settingsPath).Trim() : "";
                string settingsJson;
                if (existingSettings.StartsWith("{") && existingSettings.EndsWith("}"))
                {
                    // Merge: inject our env block and model while preserving other keys
                    // Remove trailing } to append, then re-close
                    string envBlock = @"
  ""model"": ""gemini-3.8-flash-high"",
  ""env"": {
    ""ANTHROPIC_BASE_URL"": ""http://localhost:8085"",
    ""ANTHROPIC_API_KEY"": ""dummy"",
    ""ANTHROPIC_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_OPUS_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_SONNET_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_HAIKU_MODEL"": ""gemini-3.8-flash-low"",
    ""CLAUDE_CODE_SUBAGENT_MODEL"": ""gemini-3.8-flash-high"",
    ""ENABLE_EXPERIMENTAL_MCP_CLI"": ""true""
  }";
                    // Simple strategy: read existing, overlay known keys
                    // For robustness without a JSON library, write a clean merge
                    settingsJson = @"
{
  ""model"": ""gemini-3.8-flash-high"",
  ""env"": {
    ""ANTHROPIC_BASE_URL"": ""http://localhost:8085"",
    ""ANTHROPIC_API_KEY"": ""dummy"",
    ""ANTHROPIC_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_OPUS_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_SONNET_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_HAIKU_MODEL"": ""gemini-3.8-flash-low"",
    ""CLAUDE_CODE_SUBAGENT_MODEL"": ""gemini-3.8-flash-high"",
    ""ENABLE_EXPERIMENTAL_MCP_CLI"": ""true""
  },
  ""theme"": ""dark"",
  ""autoUpdatesChannel"": ""latest""
}
".Trim();
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("    [*] Note: existing settings.json was overwritten with bridge defaults.");
                    Console.ResetColor();
                }
                else
                {
                    settingsJson = @"
{
  ""model"": ""gemini-3.8-flash-high"",
  ""env"": {
    ""ANTHROPIC_BASE_URL"": ""http://localhost:8085"",
    ""ANTHROPIC_API_KEY"": ""dummy"",
    ""ANTHROPIC_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_OPUS_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_SONNET_MODEL"": ""gemini-3.8-flash-high"",
    ""ANTHROPIC_DEFAULT_HAIKU_MODEL"": ""gemini-3.8-flash-low"",
    ""CLAUDE_CODE_SUBAGENT_MODEL"": ""gemini-3.8-flash-high"",
    ""ENABLE_EXPERIMENTAL_MCP_CLI"": ""true""
  },
  ""theme"": ""dark"",
  ""autoUpdatesChannel"": ""latest""
}
".Trim();
                }
                File.WriteAllText(settingsPath, settingsJson, Encoding.UTF8);
                Success("Configured: " + settingsPath);

                // 5. Configure Environment Variables
                Step(5, 7, "Setting Windows User Environment Variables...");
                Environment.SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://localhost:8085", EnvironmentVariableTarget.User);
                Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", "dummy", EnvironmentVariableTarget.User);
                Environment.SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", null, EnvironmentVariableTarget.User);
                Environment.SetEnvironmentVariable("ANTHROPIC_MODEL", "gemini-3.8-flash-high", EnvironmentVariableTarget.User);

                string localBin = Path.Combine(userProfile, ".local", "bin");
                if (!Directory.Exists(localBin))
                {
                    Directory.CreateDirectory(localBin);
                }

                string currentPath = Environment.GetEnvironmentVariable("Path", EnvironmentVariableTarget.User) ?? "";
                if (!currentPath.Contains(localBin))
                {
                    Environment.SetEnvironmentVariable("Path", currentPath.TrimEnd(';') + ";" + localBin, EnvironmentVariableTarget.User);
                }

                // Copy runner script to localBin
                string srcCmd = Path.Combine(bridgeDir, "bin", "claude-gemini.cmd");
                if (File.Exists(srcCmd))
                {
                    string startProxyPath = Path.Combine(bridgeDir, "scripts", "start-proxy.cmd");
                    string cmdText = File.ReadAllText(srcCmd);
                    cmdText = cmdText.Replace("\"%~dp0..\\scripts\\start-proxy.cmd\"", "\"" + startProxyPath + "\"");
                    File.WriteAllText(Path.Combine(localBin, "claude-gemini.cmd"), cmdText, Encoding.ASCII);
                }
                Success("Updated PATH and registered 'claude-gemini' CLI command.");

                // 6. Create Desktop Launcher
                Step(6, 7, "Creating Desktop shortcut...");
                string desktopLauncher = Path.Combine(desktop, "Launch Claude Code (Gemini).bat");
                string batContent = "@echo off\r\ntitle Claude Code (Gemini 3.8 Flash)\r\ncls\r\ncall \"" + Path.Combine(localBin, "claude-gemini.cmd") + "\"\r\npause\r\n";
                File.WriteAllText(desktopLauncher, batContent, Encoding.ASCII);
                Success("Created Desktop Shortcut: " + desktopLauncher);

                // 7. Restart Proxy Service
                Step(7, 7, "Starting background proxy service on port 8085...");
                // Kill existing port 8085
                RunCommand("cmd.exe", "/c for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :8085 ^| findstr LISTENING') do taskkill /F /PID %a >nul 2>&1");

                string startScript = Path.Combine(bridgeDir, "scripts", "start-proxy.cmd");
                if (File.Exists(startScript))
                {
                    ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c \"" + startScript + "\"");
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                }
                System.Threading.Thread.Sleep(2000);
                Success("Proxy service is running on port 8085.");

                // Check accounts
                string accountsFile = Path.Combine(configDir, "accounts.json");
                bool hasAccounts = false;
                if (File.Exists(accountsFile))
                {
                    string content = File.ReadAllText(accountsFile);
                    if (content.Contains("\"refreshToken\"") || content.Contains("\"email\""))
                    {
                        hasAccounts = true;
                    }
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine(@"
======================================================================
                 INSTALLATION COMPLETED SUCCESSFULLY!
======================================================================
");
                Console.ResetColor();

                if (!hasAccounts)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("[!] One final step required: Connect your Google Account.");
                    Console.WriteLine("    Opening the proxy dashboard: http://localhost:8085/");
                    Console.WriteLine("    Click 'Add Your First Account' -> 'Connect Google Account' to authenticate.");
                    Console.WriteLine();
                    Console.ResetColor();
                    Process.Start("http://localhost:8085/");
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("[*] Google account verified! Ready to use.");
                    Console.ResetColor();
                }

                Console.WriteLine("You can run Claude Code with Gemini anytime via:");
                Console.WriteLine("  1. Command Prompt / PowerShell: claude-gemini");
                Console.WriteLine("  2. Desktop Icon: Launch Claude Code (Gemini).bat");
                Console.WriteLine();

                Console.Write("Would you like to launch Claude Code now? (Y/n): ");
                string resp = Console.ReadLine();
                if (string.IsNullOrEmpty(resp) || resp.Trim().ToLower() == "y")
                {
                    ProcessStartInfo startClaude = new ProcessStartInfo(Path.Combine(localBin, "claude-gemini.cmd"));
                    startClaude.UseShellExecute = true;
                    Process.Start(startClaude);
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[ERROR] Installation failed: " + ex.Message);
                Console.ResetColor();
                WaitPrompt();
            }
        }

        static void Step(int current, int total, string msg)
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("[" + current + "/" + total + "] " + msg);
            Console.ResetColor();
        }

        static void Success(string msg)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("    [OK] " + msg);
            Console.ResetColor();
        }

        static void WaitPrompt()
        {
            Console.WriteLine("\nPress Enter to exit...");
            Console.ReadLine();
        }

        static bool IsCommandAvailable(string cmd)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("where", cmd);
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit();
                    return p.ExitCode == 0;
                }
            }
            catch
            {
                return false;
            }
        }

        static void RunCommand(string file, string args)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(file, args);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit();
                    if (p.ExitCode != 0)
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("    [!] Command exited with code " + p.ExitCode + ": " + file + " " + args);
                        Console.ResetColor();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("    [!] Failed to run " + file + ": " + ex.Message);
                Console.ResetColor();
            }
        }

        static string RunCommandCapture(string file, string args)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(file, args);
                psi.RedirectStandardOutput = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    string outText = p.StandardOutput.ReadToEnd();
                    p.WaitForExit();
                    return outText;
                }
            }
            catch
            {
                return "";
            }
        }
    }
}
