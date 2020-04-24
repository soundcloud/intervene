#### Why can I not import other modules into my config file?

Because the file is transpiled "live" in a sandboxed environment, we can't (yet) support loading external modules, other than native node modules.

#### It won't start / has errors?

Double check that there isn't another instance running. intervene starts a second privileged process to perform administrative actions (such as writing to /etc/hosts), which it tries to shutdown when the main process ends. This isn't always successful (for instance if the main process is terminated with a SIGTERM signal).
