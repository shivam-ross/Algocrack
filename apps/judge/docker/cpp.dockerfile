# Use an official GCC image which includes g++ compiler and standard libraries
FROM n0madic/alpine-gcc:7.5.0

RUN apk add --no-cache g++ build-base

# Set the working directory inside the container
# This is where the volume will be mounted (-v "${dir}":/app)
WORKDIR /app

# No CMD or ENTRYPOINT needed here.
# The code compilation and execution are handled by run.sh,
# which is executed via the 'docker run' command:
# docker run ... runner-${id} sh /app/run.sh