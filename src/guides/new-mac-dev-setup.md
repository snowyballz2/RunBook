---
title: New Mac Dev Setup
subtitle: Example guide — from a fresh macOS install to writing code
accent: azure
---

> [!NOTE]
> This is an example guide that ships with RunBook to show the format. Use it, edit it, or remove it — your real guides work the same way.

## Phase 1 — Essentials

### Install the Xcode command line tools
Almost everything below depends on a working compiler and `git`. This one command pulls in both.

```bash
xcode-select --install
```

### Install Homebrew
Homebrew is the package manager that makes the rest of this guide a few one-liners.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> [!NOTE]
> On Apple Silicon, Homebrew lives in `/opt/homebrew`. The installer prints two lines to add it to your `PATH` — run them, or your shell won't find `brew`.

## Phase 2 — Terminal & shell

### Pick a terminal and a font
Install a modern terminal and a programming font with ligatures.

```bash
brew install --cask ghostty
brew install --cask font-jetbrains-mono
```

### Make zsh comfortable
A little configuration goes a long way. Add sensible history and completion settings to your `~/.zshrc`.

> [!TIP]
> Keep your dotfiles in a git repo from day one. A new machine then becomes "clone and source", not "remember everything you did last time".

## Phase 3 — Languages & tooling

### Install language runtimes
Use a version manager rather than a single system-wide version, so each project can pin what it needs.

```bash
brew install fnm        # fast Node version manager
brew install uv         # Python toolchain & venvs
brew install rustup-init
```

> [!WARNING]
> Don't `brew install node` *and* use a version manager — you'll end up with two Nodes fighting over your `PATH`. Pick the version manager and stick with it.

### Set up git identity
Tell git who you are before your first commit, or every commit will be attributed to nobody.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

## Phase 4 — Editor

### Install your editor
Install VS Code (or your editor of choice) and enable the `code` command in `PATH` from the command palette.

```bash
brew install --cask visual-studio-code
```

### Sign in and sync
Turn on Settings Sync so extensions, keybindings, and themes follow you to the next machine. Now you're ready to build something.
