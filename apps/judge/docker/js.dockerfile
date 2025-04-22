# Use an official Node.js Alpine image (very small)
# Choose a specific LTS version relevant to your requirements (e.g., 18, 20)
FROM node:18-alpine

# Set the working directory inside the container
# This is where the volume will be mounted (-v "${dir}":/app)
WORKDIR /app

# Optional: Globally install packages if absolutely necessary (usually not needed for competitive programming style execution)
# RUN npm install -g some-global-tool

# No CMD or ENTRYPOINT needed here.
# Node.js execution is handled by run.sh (node main.js < /app/input.txt),
# which is executed via the 'docker run' command:
# docker run ... runner-${id} sh /app/run.sh