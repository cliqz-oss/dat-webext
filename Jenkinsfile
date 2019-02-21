
node('docker') {
    stage ('Checkout') {
        checkout scm
    }

    def img

    stage('Build Docker Image') {
        img = docker.build('dat-webext/build')
    }

    img.inside() {
        stage('Build') {
            sh 'rm -r ./web-ext-artifacts'
            sh 'cp -r /app/node_modules ./'
            sh 'npm run postinstall'
            sh 'npm run build'
            sh 'npm run package'
        }
    }

  if (env.BRANCH_NAME == 'master') {

        stage('Sign and publish') {
            withS3Credentials {
                // get the name of the firefox build
                def artifact = sh(returnStdout: true, script: 'ls web-ext-artifacts/ | grep dat_protocol').trim()

                // build
                def uploadPath = "cdncliqz/update/dat_protocol_pre/dat@cliqz.com"
                def uploadLocation = "s3://${uploadPath}"
                sh "aws s3 cp web-ext-artifacts/${artifact} ${uploadLocation}/  --acl public-read"

                // publish
                def artifactUrl = "https://s3.amazonaws.com/${uploadPath}/${artifact}"
                build job: 'addon-repack', parameters: [
                    string(name: 'XPI_URL', value: artifactUrl),
                    string(name: 'XPI_SIGN_CREDENTIALS', value: '41572f9c-06aa-46f0-9c3b-b7f4f78e9caa'),
                    string(name: 'XPI_SIGN_REPO_URL', value: 'git@github.com:cliqz/xpi-sign.git'),
                    string(name: 'CHANNEL', value: 'browser')
                ]
            }
        }
    }
}

def withS3Credentials(Closure body) {
    withCredentials([[
            $class: 'UsernamePasswordMultiBinding',
            credentialsId: '06ec4a34-9d01-46df-9ff8-64c79eda8b14',
            passwordVariable: 'AWS_SECRET_ACCESS_KEY',
            usernameVariable: 'AWS_ACCESS_KEY_ID']]) {
        body()
    }
}
