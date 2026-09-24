# Firebase Auth emulator for local dev. firebase-tools 15 needs Java 21, which
# trixie ships and the bookworm base the other images use does not.
FROM node:22-trixie-slim
RUN apt-get update -y && apt-get install -y openjdk-21-jre-headless && rm -rf /var/lib/apt/lists/*
RUN npm install -g firebase-tools@15
WORKDIR /app
