packer {
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = "~> 1"
    }
  }
}

variable "profile" {
  type    = string
  default = "github_actions"
}


variable "aws_region" {
  type    = string
  default = env("AWS_DEFAULT_REGION") //us-east-1
}

variable "mysql_pass" {
  type    = string
  default = env("MYSQL_PASSWORD")

}

variable "mysql_host" {
  type    = string
  default = env("DB_HOST")

}

variable "mysql_database" {
  type    = string
  default = env("DATABASE_NAME")

}
// 

variable "mysql_username" {
  type    = string
  default = env("MYSQL_USERNAME")

}

//

variable "source_ami" {
  type    = string
  default = env("SOURCE_AMI")
}

variable "ssh_username" {
  type    = string
  default = env("SSH_USERNAME") //admin
}

// variable "subnet_id" {
//   type    = string
//   default = env("DEFAULT_SUBNET_ID")
// }

# https://www.packer.io/plugins/builders/amazon/ebs
source "amazon-ebs" "my-ami" {
  profile         = "${var.profile}"
  region          = "${var.aws_region}"
  ami_users       = ["154522917611", "313509883811"]
  ami_name        = "csye6225_${formatdate("YYYY_MM_DD_hh_mm_ss", timestamp())}"
  ami_description = "AMI for CSYE 6225"
  // ami_regions = [
  //   "us-east-1",
  // ]

  aws_polling {
    delay_seconds = 120
    max_attempts  = 50
  }


  instance_type = "t2.micro"
  source_ami    = "${var.source_ami}"
  ssh_username  = "${var.ssh_username}"
  // subnet_id     = "${var.subnet_id}"

  launch_block_device_mappings {
    delete_on_termination = false
    device_name           = "/dev/xvda"
    volume_size           = 25
    volume_type           = "gp2"
  }
}

build {
  sources = ["source.amazon-ebs.my-ami"]

  provisioner "file" {
    source      = "webapp.zip"
    destination = "webapp.zip"
  }

  // provisioner "shell" {
  //   inline = [
  //     "echo 'export DATABASE_NAME=${var.mysql_database}' >> ~/.bashrc",
  //     "echo 'export MYSQL_USERNAME=${var.mysql_username}' >> ~/.bashrc",
  //     "echo 'export MYSQL_PASSWORD=${var.mysql_pass}' >> ~/.bashrc",
  //     "echo 'export DB_HOST=${var.mysql_host}' >> ~/.bashrc",
  //     "cat ~/.bashrc"

  //   ]

  // }

  provisioner "shell" {
    script = "packer/engine.sh"
    environment_vars = [
      "DATABASE_NAME=${var.mysql_database}",
      "MYSQL_USERNAME=${var.mysql_username}",
      "MYSQL_PASSWORD=${var.mysql_pass}",
      "DB_HOST=${var.mysql_host}"
    ]
  }

}

