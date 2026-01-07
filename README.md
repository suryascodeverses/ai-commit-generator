# AI Commit Generator

🤖 Generate intelligent Git commit messages using AI - supports Gemini, OpenAI, Claude, and DeepSeek.

## Features

- ✨ **Multiple AI Providers**: Choose from Gemini, OpenAI, Claude, or DeepSeek
- 🎯 **Smart Diff Processing**: Handles large changesets efficiently
- 🎨 **Multiple Styles**: GitHub Copilot style, Conventional Commits, or Detailed
- 🔒 **Secure Storage**: API keys stored securely using VS Code secrets
- ⚡ **Fast & Efficient**: Optimized for performance with intelligent truncation
- 🎪 **Easy Configuration**: Simple sidebar UI for all settings

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or install from VSIX file:
   ```bash
   code --install-extension ai-commit-generator-0.0.1.vsix
   ```

## Quick Start

1. **Open the Configuration Panel**
   - Click the AI Commit Generator icon in the activity bar (left sidebar)

2. **Set Up Your Provider**
   - Click "Provider" → Select your preferred AI provider
   - Click "API Key" → Enter your API key
   - Click "Model" → Choose a model (or use auto-select)

3. **Configure Commit Style**
   - Click "Commit Style" → Choose your preferred style:
     - **Concise** (like GitHub Copilot): "Add user authentication"
     - **Conventional**: "feat: Add user authentication"
     - **Detailed**: Multi-line with explanations

4. **Generate Commits**
   - Stage your changes in Git
   - Click the ✨ sparkle button next to "Changes" in Source Control
   - Review and commit!

## Getting Free API Keys

### 🔷 Google Gemini (Recommended for Free Tier)
**Best for:** Development & Testing
- **Free Tier**: 15 requests/minute, 1 million tokens/minute
- **Sign up**: https://aistudio.google.com/apikey
- **Steps**:
  1. Go to Google AI Studio
  2. Click "Get API key"
  3. Create new API key
  4. Copy and paste into extension

**Notes**: 
- Free tier is generous for development
- No credit card required
- Rate limits are per-minute, not daily

### 🔷 OpenAI
**Best for:** Production use
- **Free Credits**: $5 for new accounts (expires after 3 months)
- **Sign up**: https://platform.openai.com/signup
- **Steps**:
  1. Create account at OpenAI Platform
  2. Go to API Keys: https://platform.openai.com/api-keys
  3. Create new secret key
  4. Copy and paste into extension

**Notes**:
- Requires phone verification
- After free credits, pay-as-you-go pricing
- Best model: `gpt-4o-mini` (cheapest)

### 🔷 Anthropic Claude
**Best for:** High-quality responses
- **Free Credits**: $5 for new accounts
- **Sign up**: https://console.anthropic.com/
- **Steps**:
  1. Create account at Anthropic Console
  2. Go to API Keys
  3. Create new key
  4. Copy and paste into extension

**Notes**:
- Requires email verification
- Free credits expire after 1 month
- Best model: `claude-3-5-haiku-20241022` (cheapest)

### 🔷 DeepSeek
**Best for:** Budget-friendly option
- **Free Tier**: Available for testing
- **Sign up**: https://platform.deepseek.com/
- **Steps**:
  1. Create account
  2. Go to API Keys section
  3. Generate new key
  4. Copy and paste into extension

**Notes**:
- Chinese AI provider
- Very affordable pricing
- Good for coding tasks

## Commit Styles

### Concise (GitHub Copilot Style)
```
Add README and initial text file for project documentation
Update user authentication logic in auth.ts
Fix null pointer exception in payment handler
Remove deprecated config files
```

### Conventional Commits
```
feat: Add user authentication module
fix: Resolve memory leak in cache handler
docs: Update API documentation
style: Format code with prettier
refactor: Extract validation logic to utils
```

### Detailed
```
Add user authentication system

- Implement JWT-based authentication
- Add login and logout endpoints
- Create middleware for token verification
- Add tests for auth flows
```

## Features in Detail

### Smart Diff Processing
- Automatically detects large changesets (>200 lines or >5 files)
- Creates intelligent summaries instead of sending full diffs
- Identifies formatting-only changes
- Handles file additions, modifications, and deletions

### Output Panel
- View detailed logs of what's happening
- See which model is being used
- Monitor API responses
- Debug errors easily

### Configuration Management
- Provider selection (Gemini, OpenAI, Claude, DeepSeek)
- API key management (secure storage)
- Model selection (with auto-detection for Gemini)
- Commit style preferences
- Maximum message length

## Commands

- `AI Commit: Generate Commit Message` - Generate commit from staged changes
- `AI Commit: Open Configuration` - Open configuration panel
- `AI Commit: Set Provider` - Change AI provider
- `AI Commit: Set API Key` - Update API key
- `AI Commit: Set Model` - Choose AI model
- `AI Commit: Set Commit Style` - Change commit message style

## Keyboard Shortcuts

No default shortcuts, but you can add your own:
1. `Ctrl+Shift+P` → "Preferences: Open Keyboard Shortcuts"
2. Search for "AI Commit"
3. Add your preferred shortcut

## Troubleshooting

### "Rate limit exceeded" or "Quota exceeded"
- **Solution 1**: Wait 1 minute and try again
- **Solution 2**: Switch to a different model
- **Solution 3**: Try a different provider
- **Solution 4**: Reduce the size of your changes (commit more frequently)

### "No API key found"
- Make sure you've set the API key for your selected provider
- Click "API Key" in the configuration panel
- The key is stored securely in VS Code secrets

### "Git extension not found"
- Make sure Git is installed on your system
- Restart VS Code
- Check that the Git extension is enabled

### "No staged changes found"
- Stage your changes first: `git add <files>`
- Or use VS Code's Source Control panel to stage changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See LICENSE file for details

## Credits

Made with ❤️ for developers who want better commit messages

## Support

- **Issues**: https://github.com/suryascodeverses/ai-commit-generator/issues