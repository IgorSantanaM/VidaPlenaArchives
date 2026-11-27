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
    zone = "us-central1-a"
}
# ALTERAR
resource "google_storage_bucket" "qwiklabs-gcp-04-31507d7595b0-us" {
    name                        = "qwiklabs-gcp-04-31507d7595b0-us"
  project                     = "qwiklabs-gcp-04-31507d7595b0"
  location                    = "US"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true

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