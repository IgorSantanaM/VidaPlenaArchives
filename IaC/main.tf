terraform {
    required_providers {
        google = {
            source = "hashicorp/google"
            version = ">= 5.0.0"
        }
    }
}

provider "google" {
    project = var.project_id
    region = "us-central1"
}

variable "project_id" {
    type = string
    description = "id do projeto GCP do laboratório"
}

resource "google_storage_bucket" "exames_hospital_vida_plena" {
    name     = "hospital-vida-plena-exames-${var.project_id}"
    project = var.project_id
    location = "us-central1"

    storage_class = "STANDARD"

    force_destroy = true

    uniform_bucket_level_access =  true

    versioning {
        enabled = true
    }

    lifecycle_rule {
        condition {
            age = 30
            matches_prefix = ["documents/"]
        }
        action {
            type = "SetStorageClass"
            storage_class = "NEARLINE"
        }
    }
    lifecycle_rule {
        condition {
            age = 90
            matches_prefix = ["documents/"]
        }
        action {
            type = "SetStorageClass"
            storage_class = "COLDLINE"
        }
    }
    lifecycle_rule {
        condition {
            age = 365
            matches_prefix = ["documents/"]
        }
        action {
            type = "SetStorageClass"
            storage_class = "ARCHIVE"
        }
    }

    lifecycle_rule {
        condition {
            days_since_custom_time = 0
            matches_prefix = ["documents/"]
        }
        action {
            type = "Delete"
        }
    }
}