<h1 align="center">
	<img src="./public/resources/image/icon-64x64.png" alt="The rainbow flag" width="48" height="32" valign="middle" />
	<a href="https://fly-the-rainbow-flag.com/">fly-the-rainbow-flag.com</a>: development
</h1>

Development overview, for those who might be interested in contributing.

- Assumes knowledge in developing [Node.js](https://nodejs.org/) applications, including using `npm`.
- Using [`./containerization/`](./containerization/) is optional.
- Patches welcome!

## Production deployment

The FTRF server has been prepared to be hosted in a container, primarily for production deployments.

- See `Containerfile` for the server image.
- See Kubernetes YAML files in [`./containerization/`](./containerization/) for deployment.

## Local development

For faster iteration, use debug mode locally.

### Local configuration

- Uses [Configvention](https://joelpurra.com/projects/nodejs-configvention/) ([npm](https://www.npmjs.com/package/configvention), [github](https://github.com/joelpurra/nodejs-configvention)).
- Defaults are stored in `./app/web.js.defaults.config.json`.
- Add an override file next to the defaults: `./app/web.js.config.json`.
  - The key-value naming and structure is the same as the defaults file; copy the relevant lines and fill in own values.
- Can also use environment variables, like containerized FTRF.

### Debug mode

```shell
npm run --silent debug
```

### Production mode

```shell
npm run --silent start
```

### Linting

Keep it clean. Note that linting is verified by a commit hook.

```shell
npm run --silent lint:fix
```

---

<a href="https://fly-the-rainbow-flag.com/"><img src="./public/resources/image/icon-64x64.png" alt="The rainbow flag" width="24" height="16" valign="middle" /></a> Copyright &copy; 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, [Joel Purra](https://joelpurra.com/). All rights reserved. Released under the [GNU Affero General Public License 3.0 (AGPL-3.0)](https://en.wikipedia.org/wiki/Affero_General_Public_License).
