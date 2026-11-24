output "bucket_name" {
    description = "Nome do bucket criado"
    value = google_storage_bucket.exames_hospital_vida_plena.name
}