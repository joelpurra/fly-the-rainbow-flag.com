<h1 align="center">
	<img src="../public/resources/image/icon-64x64.png" alt="The rainbow flag" width="48" height="32" valign="middle" />
	<a href="https://fly-the-rainbow-flag.com/">fly-the-rainbow-flag.com</a>: containerization
</h1>

Set up and host the FTRF website in a container.

- The server image is built from `../Containerfile`.
- The below commands are expected to be executed in the `./containerization/` directory.
- See also [`../DEVELOP.md`](../DEVELOP.md), in particular for local development.

## Software

- This documentation assumes [Podman](https://podman.io/) for building images and managing containers.
- The FTRF server is configured using [Podman's Kubernetes YAML support](https://docs.podman.io/en/latest/markdown/podman-kube-play.1.html).
- Assumes using [Podman's rootless container support](https://developers.redhat.com/blog/2020/09/25/rootless-containers-with-podman-the-basics), which extends to running rootless Kubernetes pods.
- See also alternatives such as [Docker](https://docker.com/) and [Kubernetes](https://kubernetes.io/).

## Configuration

- Uses [Configvention](https://joelpurra.com/projects/nodejs-configvention/) ([npm](https://www.npmjs.com/package/configvention), [github](https://github.com/joelpurra/nodejs-configvention)).
- Use environment variables to override defaults in `../app/web.js.defaults.config.json`.
  - Nested properties are referenced in environment variables using `__` (two underscores).
- Use Kubernetes [config maps](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/) and [secrets](https://kubernetes.io/docs/concepts/configuration/secret/) to inject environment variables.
  - Kubernetes-specific defaults are stored as a config map in `ftrf.yaml`.
  - The names of the separate configmap/secret need to match the hardcoded (suggested) name references in `ftrf.yaml`.
- Local development overrides in `../app/web.js.config.json` are deliberately _not_ included when building the image.

### Secrets configuration

Access tokens should be stored as a set of secrets with name `ftrf` (suggested).

When using [Podman secrets](https://docs.podman.io/en/latest/markdown/podman-secret.1.html), make sure they are [added as Kubernetes YAML secrets](https://www.redhat.com/sysadmin/podman-kubernetes-secrets).

```shell
# NOTE: replace previous ftrf secret.
podman secret exists ftrf && podman secret rm ftrf

# NOTE: "play" yaml file to add secret for Kubernetes.
podman kube play ftrf.secret.yaml
```

### General configuration

Optionally add overrides in the configmap with name `ftrf` (suggested).

- Optionally copy `ftrf.yaml.configmap.sample.yaml` to `ftrf.yaml.configmap.yaml` (suggested) and make your own environment variable modifications.
- Optionally, load the debug configuration named `ftrf-debug` from `./ftrf.configmap.debug.yaml`.
  - Prepared for developer debugging, not suitable for production systems.
  - Disables redirecting from HTTP to HTTPS, as well as HSTS.
  - Increases logging, in particular of configuration values (including secret API keys).
- The awkward (suggested) file naming is there to aid [Podman's systemd integration](#systemd), so that the paths do not have to be manually configured.
- The system configuration and debug files can be kept separately, since Podman allows multiple [`--configmap`](https://docs.podman.io/en/latest/markdown/podman-kube-play.1.html#configmap-path) uses.

## Build image from remote repository

Fetch and build directly from the [latest code hosted on github](https://github.com/joelpurra/fly-the-rainbow-flag.com).

```shell
podman build \
	--tag 'localhost/ftrf:latest' \
	https://github.com/joelpurra/fly-the-rainbow-flag.com
```

## Build image from local repository

Useful for debugging containerization.

- Local code changes apply, so be careful not to use an unclean commit for production deployment.
- Have a look at `../.containerignore` to see which files are included/excluded.

```shell
# NOTE: the image context is the root of the repository.
podman build \
	--tag 'localhost/ftrf:latest' \
	--file Containerfile \
	..
```

## Start the pod

Please set up a restrictive firewall first, in order to not accidentally expose any server ports to the outside world.

- Note the use of the override and debug configmaps (both optional).
- Port 5000 (configurable) is explicitly exposed, by setting `hostPort` in `ftrf.yaml`.
  - Podman, which only runs on a single host, does not support [`kind: Service`](https://kubernetes.io/docs/concepts/services-networking/service/). Using `hostPort` is [frowned upon in scalable Kubernetes](https://kubernetes.io/docs/concepts/configuration/overview/#services) though.
  - Can also explicitly [`--publish`](https://docs.podman.io/en/latest/markdown/podman-kube-play.1.html#publish-ip-hostport-containerport-protocol) the desired port. Example: `--publish '[::1]:5000:5000/tcp' --publish '127.0.0.1:5000:5000/tcp'`

```shell
# NOTE: ensure a firewall is running first.
podman kube play \
	--replace \
	--configmap ftrf.yaml.configmap.yaml \
	--configmap ftrf.yaml.configmap.debug.yaml \
	ftrf.yaml
```

Visit http://localhost:5000/ to test the site.

```shell
# NOTE: check the logs to verify that AWS S3 and Blitline work as expected.
podman logs --tail 1000 --follow ftrf-pod-ftrf-nodejs | npx bunyan
```

## Clean up afterwards

```shell
podman kube play \
	--down \
	ftrf.yaml

podman pod rm ftrf-pod

podman image rm localhost/ftrf:latest
```

## Systemd

For a production server running 24/7, use Podman's systemd integration [podman-kube@.service](https://docs.podman.io/en/latest/markdown/podman-generate-systemd.1.html#kubernetes-integration) with your own (escaped) YAML path as the unit instance "name". This works well for non-root users, if the [user is allowed to linger](https://www.redhat.com/sysadmin/container-systemd-persist-reboot).

To explicitly expose the server port in `podman-kube@.service`, create a [unit override file](https://www.freedesktop.org/software/systemd/man/systemd.unit.html) to add command line arguments for the configmap(s).

### Example override.conf

Adding `--configmap %I.configmap.yaml` to the `podman kube play` command allows a simplified path handling. Here, [the unescaped unit instance name specifier `%I`](https://www.freedesktop.org/software/systemd/man/systemd.unit.html#Specifiers) is the path to the Kubernetes YAML file (between `podman-kube@` and `.service`). Thus, `%I.configmap.yaml` is a configmap file located next to the deployment yaml.

```shell
[Service]
ExecStart=
ExecStart=/usr/bin/podman play kube --replace --service-container=true --configmap %I.configmap.yaml %I
```

The first [`ExecStart=`](https://www.freedesktop.org/software/systemd/man/systemd.service.html#ExecStart=) is empty to reset the service unit command list before overriding it (rather than inadvertently running two commands in sequence). Note that the [original `podman-kube@.service`](https://github.com/containers/podman/blob/main/contrib/systemd/system/podman-kube%40.service.in) command may change between [Podman releases](https://github.com/containers/podman/releases); see `/usr/lib/systemd/user/podman-kube@.service` (or equivalent path) for your local version.

---

<a href="https://fly-the-rainbow-flag.com/"><img src="../public/resources/image/icon-64x64.png" alt="The rainbow flag" width="24" height="16" valign="middle" /></a> Copyright &copy; 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, [Joel Purra](https://joelpurra.com/). All rights reserved. Released under the [GNU Affero General Public License 3.0 (AGPL-3.0)](https://en.wikipedia.org/wiki/Affero_General_Public_License).
