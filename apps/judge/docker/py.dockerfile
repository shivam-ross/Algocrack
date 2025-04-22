# Use an official Python slim image (good balance of size and features)
# Choose a specific version relevant to your requirements (e.g., 3.10, 3.11)
FROM python:3.11-slim

# Set the working directory inside the container
# This is where the volume will be mounted (-v "${dir}":/app)
WORKDIR /app

# Optional: Install common libraries if needed for your coding problems
# Uncomment the following line to install numpy, for example:
# RUN pip install --no-cache-dir numpy requests

# No CMD or ENTRYPOINT needed here.
# Python execution is handled by run.sh (python3 main.py < /app/input.txt),
# which is executed via the 'docker run' command:
# docker run ... runner-${id} sh /app/run.sh