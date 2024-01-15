async function submit(task) {
    return new Promise((resolve, reject) => {
        task().then(resolve).catch(reject);
    });

    
}