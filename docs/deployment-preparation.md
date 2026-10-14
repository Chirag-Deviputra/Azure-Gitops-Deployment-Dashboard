# Deployment preparation

Code is prepared here; no cloud resources or public endpoints are created by this change.

## Checks and release behavior

Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and
`PYTHONPATH=backend pytest backend/tests` after installing `backend/requirements.txt`.
CI additionally lints/renders Helm and builds both Docker images. PRs never publish
images or update deployment tags. Successful main builds publish both SHA images,
then commit both Helm tags together. Argo CD detects that Git change. The bot commit
uses GITHUB_TOKEN, so it does not recursively trigger this workflow. If main advances,
a stale run skips promotion; a concurrent push fails without forcing history. Branch
rules must permit the promotion commit; otherwise configure an approved promotion
process before relying on automatic delivery. Configure required branch checks for
this new workflow before retiring any required checks named Frontend CI/Backend CI.

## Bootstrap and an existing cluster

1. Install Kubernetes and Argo CD. Create the `gitops-dev` namespace.
2. Before syncing the updated application, apply `bootstrap/argocd-reader.yaml` as
   a cluster administrator. It grants only GET of the named Argo CD Application.
   If the old application managed this Role/RoleBinding, first detach their Argo CD
   tracking metadata so automatic pruning does not delete them:

   ```sh
   kubectl -n argocd annotate role/gitops-dashboard-argocd-reader rolebinding/gitops-dashboard-argocd-reader argocd.argoproj.io/tracking-id- --overwrite
   kubectl -n argocd label role/gitops-dashboard-argocd-reader rolebinding/gitops-dashboard-argocd-reader app.kubernetes.io/instance- --overwrite
   kubectl apply -f bootstrap/argocd-reader.yaml
   ```

   Coordinate this with auto-sync paused on an existing application until the new
   revision is selected, then resume. These names assume namespace `gitops-dev`;
   change the binding subject if using another namespace. Do not broaden the
   AppProject to deploy arbitrary resources into `argocd`.
3. Install kube-prometheus-stack as release `monitoring` in namespace `monitoring`
   using `monitoring/values.yaml` and an explicitly chosen chart version. A default
   StorageClass is required; override the PVC storage classes for your host. This
   configuration is for development and disables Alertmanager notifications.
4. Either enable `monitoring.enabled` in Helm (recommended for GitOps ownership),
   or apply `monitoring/service-monitor.yaml` separately. Do not manage the same
   ServiceMonitor through both methods. Install operator CRDs first. The chart's
   default disables this resource so basic installs work without monitoring.
5. Apply `monitoring/alert-rules.yaml`; import `monitoring/grafana-dashboard.json`
   into Grafana with a Prometheus datasource. Alerts evaluate there but do not send
   notifications until Alertmanager and a receiver are configured.
6. Apply `argocd/project.yaml`, then `argocd/application.yaml`. Verify GHCR images
   are public, or configure image-pull credentials before deploying private images.

## Public hosting (later)

Choose the host before provisioning anything. AWS is not assumed to be permanently
free. Do not apply the Azure Terraform files for an AWS deployment.

The optional ingress requires `ingress.enabled=true`, a real `ingress.host`, the
installed ingress controller's `ingress.className`, and an existing valid TLS secret
in `ingress.tlsSecretName`. DNS, certificate issuance, authentication and the ingress
controller are hosting setup tasks; this chart does not create them. Keep Argo CD,
Grafana, Prometheus and the backend private. Before exposing dashboard data publicly,
choose access protection or explicitly approve a public read-only demonstration.

Validate image startup, both API routes with actual cluster data, Prometheus targets,
persistence across restart, a commit-triggered rollout, and rollback on that cluster.
Revert deployment tags to known published SHA tags for rollback; do not rebuild an
old release under a mutable tag.

## Docker Compose

The frontend uses `BACKEND_URL=http://backend:8000`. Compose is only a container
smoke-test environment by default: the backend intentionally reports unavailable
cluster data without Kubernetes credentials/API connectivity and Prometheus access.
Do not copy service-account credentials into images or commit them to Git.
