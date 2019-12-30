const parse = require('co-body');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { exec } = require('child_process');
const config = require('./config');

const REPO_URL = 'git@github.com:fff455/fe-share.git';
const REPO_HTTPS = 'https://github.com/fff455/fe-share';
const TEMP_FOLDER = 'temp_folder';

const execAsync = async command => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
      }
      if (stdout) console.log(`stdout: ${stdout}`);
      if (stderr) console.error(`stderr: ${stderr}`);
      resolve();
    });
  })
};

const updateReadme = ({ files, folders }) => {
  const renderMap = {
    record: folders
      .map(({ name }) => `* [${name}](${REPO_HTTPS}/tree/master/${name})`)
      .join('\n'),
    member: config.member.members
      .map(({ name, url }) => `* [${name}](${url})`)
      .join('\n'),
    content: files
      .sort((a, b) => a.modifiedTime - b.modifiedTime)
      .filter(({ modifiedTime }) => moment(modifiedTime).isAfter(moment().subtract(7, 'days')))
      .map(({ name, path, modifiedTime }) => `* [${name}](https://github.com/fff455/fe-share/tree/master/${path}) ${moment(modifiedTime).format('YYYY-MM-DD')} update.`)
      .join('\n'),
  }
  const title = `# ${config.repo.title}`;
  const modules = config.modoles.map(moduleKey => {
    const moduleConfig = config[moduleKey];
    return `<!-- ${moduleConfig.title.toUpperCase()}-START -->
## ${moduleConfig.title}
${renderMap[moduleKey]}
<!-- ${moduleConfig.title.toUpperCase()}-END -->`
  }).join('\n\n');
  const readmeContent = `
${title}

${modules}

`;
  return readmeContent;
};

const getFolderLevel1 = rootPath => {
  const readDir = fs.readdirSync(rootPath);
  const excludeFolders = ['.git'];
  return readDir.reduce((folders, p) => {
    const subPath = path.resolve(rootPath, p);
    const stat = fs.statSync(subPath);
    if (stat.isDirectory() && !excludeFolders.includes(p)) {
      const directory = {
        name: p,
        path: subPath,
      };
      return folders.concat(directory);
    }
    return folders;
  }, []);
};

const getFilesFromFolders = (rootPath, folders) => {
  const docPostfix = [/\.md$/];
  return folders.map(folder => {
    const folderPath = path.resolve(rootPath, folder);
    const readDir = fs.readdirSync(folderPath);
    const { files, subFolders } = readDir.reduce(({ files, subFolders }, p) => {
      const subFilePath = path.resolve(folderPath, p);
      const stat = fs.statSync(subFilePath);
      if (stat.isDirectory()) {
        // directory
        return { files, subFolders: subFolders.concat(p) };
      } else if (docPostfix.some(postfix => p.match(postfix))) {
        // file
        const file = {
          name: p,
          modifiedTime: stat.mtimeMs,
          path: subFilePath,
        };
        return { files: files.concat(file), subFolders };
      } else {
        // ignore other type
        return { files, subFolders };
      }
    }, { files: [], subFolders: [] });
    const subFoldersFiles = getFilesFromFolders(path.resolve(rootPath, folder), subFolders);
    return files.concat(subFoldersFiles);
  }).reduce((s, i) => s.concat(i), []);
}

const update = async msg => {
  const repoPath = path.resolve(__dirname, TEMP_FOLDER);
  const tempPath = path.resolve(repoPath, 'fe-share');
  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(repoPath);
    await execAsync(`cd ${repoPath} && git clone ${REPO_URL}`);
    // await execAsync(`doctoc ${docPath} --title '**${date} Trending ${timeSlice.replace(/^./, a => a.toUpperCase())}**'`);
    // console.log(`The file ${docPath} exists.`);
  }
  await execAsync(`cd ${tempPath} && git pull`);
  const folders = getFolderLevel1(tempPath);
  console.log('folders: ', folders);
  const files = getFilesFromFolders(tempPath, folders.map(f => f.path))
    .map(file => ({ ...file, path: path.relative(tempPath, file.path) }));
  console.log('files: ', files);
  const content = updateReadme({ files, folders });
  fs.writeFileSync(path.resolve(tempPath, 'README.md'), content);
  console.log(`Update finish.`);
  await execAsync(`cd ${tempPath} && git pull && git add . && git commit -m "webhook: update README" && git push origin master`);
};

module.exports = async ctx => {
  console.log('Begin update')
  try {
    const post = await parse(ctx.request);
    console.log('post: ', post);
    update();
    ctx.body = {
      code: 0,
      message: 'success',
    };
  } catch (err) {
    console.error('Error in update:', err);
    ctx.body = {
      code: 1,
      message: err,
    };
  }
}