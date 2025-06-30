// MINIMAL TEST CONTENT SCRIPT
console.log('🟢🟢🟢 TEST CONTENT SCRIPT LOADED SUCCESSFULLY! 🟢🟢🟢');
console.log('🟢 URL:', window.location.href);
console.log('🟢 Time:', new Date().toISOString());

// Create test function immediately
window.testMinimalExtension = () => {
  console.log('✅ MINIMAL EXTENSION IS WORKING!');
  alert('✅ Extension content script is loaded and working!');
  return 'SUCCESS!';
};

console.log('🟢 testMinimalExtension function created');