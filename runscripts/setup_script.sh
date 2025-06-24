# instructions: download this file separately and move it into the home
# directory of the virtual machine being used to set up the server.
# in the command line, enter:
# chmod +x setup_script.sh
# ./setup_script.sh

echo "Enter your username, as shown in the terminal <username>@instance."
read first_arg
username="$first_arg"
echo "Enter a Google Drive link to the \"elbs_main-nime.zip\" file,"
echo "which you can download from https://github.com/arililoia-cmu/elbs_nime"
read second_arg
gdrive_link="$second_arg"
echo "Enter a password for users to join the server:"
read third_arg
password="$third_arg"

sudo apt update
sudo apt install python3 python3-dev python3-venv
sudo apt-get install wget
wget https://bootstrap.pypa.io/get-pip.py
sudo python3 get-pip.py
pip3 --version

pip3 install midiutil
pip3 install numpy

sudo apt upgrade

cd ~; mkdir downloads
wget --no-check-certificate -c --header "Cookie: oraclelicense=accept-securebackup-cookie" https://download.oracle.com/java/18/latest/jdk-18.0.2_linux-x64_bin.tar.gz
mv jdk-18.0.2_linux-x64_bin.tar.gz downloads
sudo mkdir /usr/lib/jvm
cd /usr/lib/jvm
sudo tar -xvzf ~/downloads/jdk-18.0.2_linux-x64_bin.tar.gz
env_var="/etc/environment"
sudo vi -c "normal GoPATH=:/usr/lib/jvm/jdk-18.0.2/bin" -c ":1d" -c "wq" "$env_var"

sudo update-alternatives --install "/usr/bin/java" "java" "/usr/lib/jvm/jdk-18.0.2/bin/java" 0
sudo update-alternatives --install "/usr/bin/javac" "javac" "/usr/lib/jvm/jdk-18.0.2/bin/javac" 0
sudo update-alternatives --set java /usr/lib/jvm/jdk-18.0.2/bin/java
sudo update-alternatives --set javac /usr/lib/jvm/jdk-18.0.2/bin/javac

update-alternatives --list java
update-alternatives --list javac
java -version

sudo apt-get update
MVN="3.8.8"
wget https://downloads.apache.org/maven/maven-3/$MVN/binaries/apache-maven-$MVN-bin.tar.gz -P /tmp
sudo tar xf /tmp/apache-maven-$MVN-bin.tar.gz -C /opt
sudo rm /tmp/apache-maven-$MVN-bin.tar.gz
sudo ln -s /opt/apache-maven-$MVN /opt/maven

mp_var="/etc/profile.d/maven.sh"
sudo vi -c "normal Goexport JAVA_HOME=/usr/lib/jvm/jdk-18.0.2" -c "normal Goexport M2_HOME=/opt/maven" -c "normal Goexport MAVEN_HOME=/opt/maven" -c "normal Goexport PATH=\$M2_HOME/bin:\$PATH" -c ":1d" -c "wq" "$mp_var"
# sudo chown "$username" "$mp_var"
# sudo chmod +x "$mp_var"
# source "$mp_var"
# mvn -v

echo "end"
echo "$username"

sudo apt install unzip
cd ~; mkdir gdc; cd gdc

python3 <<EOF
import os
final_dir = '~/gdc'
get_file_id_from_google_drive_link = lambda file_link:file_link.split('/d/')[-1].split('/view')[0]
get_wget_command = lambda file_id,save_name: f'wget --load-cookies ~/cookies.txt "https://docs.google.com/uc?export=download&confirm=$(wget --quiet --save-cookies ~/cookies.txt --keep-session-cookies --no-check-certificate "https://docs.google.com/uc?export=download&id={file_id}" -O- | sed -rn "s/.*confirm=([0-9A-Za-z_]+).*/\1\n/p")&id={file_id}" -O {save_name} && rm -rf ~/cookies.txt'
download_files_google_drive_link_list = [
    ('gdc-main.zip','$gdrive_link'),
]
for google_drive_link in download_files_google_drive_link_list:
  print(f'downloading: {google_drive_link[0]}')
  os.system(get_wget_command(get_file_id_from_google_drive_link(google_drive_link[1]),f'{final_dir}/{google_drive_link[0]}'))
EOF

unzip elbs_nime-main
mv elbs_nime-main gdc-main
cp -Rp gdc-main/* gdc-main/.gitignore .
rm -rf gdc-main

cd ~/gdc/webbit/gdcserver
mkdir target
wget https://repo1.maven.org/maven2/io/netty/netty/3.6.5.Final/netty-3.6.5.Final.jar

cd ~/gdc/webbit/gdcserver
vi -c ":%s/<maven.compiler.source>16/<maven.compiler.source>11/g" -c "wq" pom.xml 
vi -c ":%s/<maven.compiler.target>16/<maven.compiler.target>11/g" -c "wq" pom.xml 
mvn package

mkdir -p src/main/resources
echo "$password" >> "src/main/resources/adminPassword.txt"
echo "" >> "src/main/resources/adminPassword.txt"
mkdir logs

echo "Now copy and paste the following commands one at a time into the terminal:"
echo "username=<your username>"
echo "mp_var="/etc/profile.d/maven.sh""
echo "sudo chown "\$username" "\$mp_var""
echo "sudo chmod +x "\$mp_var""
echo "source "\$mp_var""
echo "mvn -v"
echo "# ^ this check for some reason doesn't pass in the shell script"
echo "cd ~/gdc/webbit/gdcserver"
echo "mvn package"
echo ""
echo "Then start with the following command:"
echo "java -cp target/gdcserver-1.0-SNAPSHOT.jar:../../../.m2/repository/io/netty/netty/3.6.5.Final/netty-3.6.5.Final.jar Gdc"
