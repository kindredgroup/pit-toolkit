{{- define "application.name" -}}
{{- default .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end -}}

{{- define "application.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{.Chart.Version}}
{{ include "application.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "application.selectorLabels" -}}
app.kubernetes.io/name: {{ include "application.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
